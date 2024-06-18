import {
  DrawPolygonMode,
  EditableGeoJsonLayer,
  ViewMode,
} from '@deck.gl-community/editable-layers';
import {
  MapboxOverlay as DeckOverlay,
  MapboxOverlayProps,
} from '@deck.gl/mapbox';
import {cellToBoundary, latLngToCell} from 'h3-js';
import {FC, useMemo} from 'react';
import {Map} from 'maplibre-gl';
import React, {useCallback, useEffect, useState} from 'react';
import {useControl, useMap} from 'react-map-gl/maplibre';
import {DrawingMode, useAppStore} from './store';
import {colorToRGBA} from './utils';
import {rgb} from 'd3';

export type MapOverlayProps = {};

function DeckGLOverlay(props: MapboxOverlayProps): null {
  const overlay = useControl(({map}) => {
    const mapInstance = map.getMap() as Map;
    mapInstance?.dragPan.disable();
    mapInstance.doubleClickZoom.disable();
    mapInstance.dragRotate.disable();
    mapInstance.touchPitch.disable();
    mapInstance.boxZoom.disable();
    return new DeckOverlay(props);
  });
  overlay.setProps(props);
  return null;
}

export const MapOverlay: FC<MapOverlayProps> = (props) => {
  const map = useMap();
  const mapInstance = map.current?.getMap();
  const drawingMode = useAppStore((state) => state.mode);
  const [isPanning, setIsPanning] = useState(false);
  const color = useAppStore((state) => state.color);
  const colorRGB = useMemo(() => colorToRGBA(color), [color]);

  const {features, addFeature, initialize} = useAppStore((state) => ({
    features: state.features,
    addFeature: state.addFeature,
    initialize: state.initialize,
  }));

  // add space keyboard event listener
  useEffect(() => {
    const onKeyDown = (evt) => {
      if (evt.key === ' ') {
        mapInstance?.dragPan.enable();
        setIsPanning(true);
      }
    };
    const onKeyUp = (evt) => {
      if (evt.key === ' ') {
        mapInstance?.dragPan.disable();
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);
  useEffect(() => {
    setDrawPolygons({type: 'FeatureCollection', features: features});
  }, [features]);
  useEffect(() => {
    if (drawingMode === DrawingMode.DRAW_HEXAGON) {
    } else {
      mapInstance?.dragPan.enable();
    }
  }, [drawingMode, mapInstance]);

  const [drawPolygons, setDrawPolygons] = useState({
    type: 'FeatureCollection',
    features: features,
  });

  const layers = [
    new EditableGeoJsonLayer({
      id: 'editable-geojson-layer',
      data: drawPolygons,
      mode:
        drawingMode === DrawingMode.DRAW_POLYGON
          ? DrawPolygonMode
          : drawingMode === DrawingMode.DRAW_HEXAGON
          ? ViewMode
          : ViewMode,
      selectedFeatureIndexes: [],
      pickable: true,

      onEdit: ({updatedData, editType, editContext}) => {
        setDrawPolygons(updatedData);
        if (editType === 'addFeature') {
          const {featureIndexes} = editContext;
          if (featureIndexes.length > 0) {
            addFeature({
              ...updatedData.features[featureIndexes[0]],
              properties: {color},
            });
          }
        }
      },

      getFillColor: (f) =>
        f.properties.color ? colorToRGBA(f.properties.color) : colorRGB,
      getLineColor: (f) =>
        f.properties.color ? colorToRGBA(f.properties.color) : colorRGB,
    }),
  ];
  // console.log(features);

  const handleAddHexagon = useCallback(
    (event) => {
      const [lng, lat] = event.coordinate;
      const h3 = latLngToCell(lat, lng, Math.max(6, event.viewport.zoom - 2));
      const boundary = cellToBoundary(h3, true);
      addFeature({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [boundary],
        },
        properties: {color},
      });
    },
    [addFeature, color]
  );

  const handleClick = useCallback(
    (event) => {
      if (isPanning) return;
      if (drawingMode === DrawingMode.DRAW_HEXAGON) {
        handleAddHexagon(event);
      }
    },
    [drawingMode, isPanning]
  );

  const handleDrag = useCallback(
    (event) => {
      if (isPanning) return;
      if (drawingMode === DrawingMode.DRAW_HEXAGON) {
        handleAddHexagon(event);
      }
    },
    [drawingMode, isPanning]
  );

  return (
    <DeckGLOverlay
      layers={layers}
      getCursor={() => (isPanning ? 'grab' : 'crosshair')}
      onClick={handleClick}
      onDrag={handleDrag}
      interleaved
    />
  );
};
