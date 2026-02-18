'use client';

import { useState, useCallback } from 'react';
import type {
  BuildingEstimate,
  BuildingQuickOptions,
  Measurements,
  RoofSystemType,
} from '@/types';

// Internal type: roofSystem can be '' for "not yet selected"
export type BuildingEstimateState = Omit<BuildingEstimate, 'roofSystem'> & {
  roofSystem: RoofSystemType | '';
};

function parsePitchNum(pitch: string): number {
  return parseInt((pitch || '').split(/[/:]/)[0], 10) || 0;
}

const defaultQuickOptions: BuildingQuickOptions = {
  tearOff: false,
  replaceOSB: false,
  steepPitch: false,
  overnightRequired: false,
  complexAccess: false,
};

function getDefaultQuickOptions(measurements: Measurements): BuildingQuickOptions {
  const pitchNum = parsePitchNum(measurements.predominant_pitch);
  return { ...defaultQuickOptions, steepPitch: pitchNum >= 7 };
}

export function useBuildings() {
  const [buildings, setBuildings] = useState<BuildingEstimateState[]>([]);
  const [activeBuildingId, setActiveBuildingId] = useState<string | null>(null);

  const addBuilding = useCallback((name: string, measurements: Measurements) => {
    const id = crypto.randomUUID();
    const building: BuildingEstimateState = {
      id,
      name,
      roofSystem: '',
      quickOptions: getDefaultQuickOptions(measurements),
      measurements,
      selectedItems: [],
      smartSelectionComplete: false,
      isCollapsed: false,
    };
    setBuildings((prev) => [...prev, building]);
    setActiveBuildingId(id);
  }, []);

  const removeBuilding = useCallback((id: string) => {
    setBuildings((prev) => prev.filter((b) => b.id !== id));
    setActiveBuildingId((curr) => (curr === id ? null : curr));
  }, []);

  const updateBuilding = useCallback(
    (id: string, updates: Partial<BuildingEstimateState>) => {
      setBuildings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
      );
    },
    []
  );

  const updateBuildingsBatch = useCallback(
    (updatesByBuildingId: Record<string, Partial<BuildingEstimateState>>) => {
      setBuildings((prev) =>
        prev.map((b) => {
          const updates = updatesByBuildingId[b.id];
          return updates ? { ...b, ...updates } : b;
        })
      );
    },
    []
  );

  const updateBuildingRoofSystem = useCallback(
    (id: string, roofSystem: RoofSystemType) => {
      updateBuilding(id, { roofSystem });
    },
    [updateBuilding]
  );

  const updateBuildingQuickOption = useCallback(
    (id: string, option: keyof BuildingQuickOptions, value: boolean) => {
      setBuildings((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, quickOptions: { ...b.quickOptions, [option]: value } }
            : b
        )
      );
    },
    []
  );

  const updateBuildingMeasurements = useCallback(
    (id: string, measurements: Measurements) => {
      updateBuilding(id, { measurements });
    },
    [updateBuilding]
  );

  const toggleBuildingCollapsed = useCallback((id: string) => {
    setBuildings((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, isCollapsed: !b.isCollapsed } : b
      )
    );
  }, []);

  const allBuildingsHaveRoofSystem = useCallback(
    () => buildings.every((b) => b.roofSystem !== ''),
    [buildings]
  );

  const getTotalSquares = useCallback(
    () =>
      buildings.reduce(
        (sum, b) => sum + (b.measurements.total_squares ?? 0),
        0
      ),
    [buildings]
  );

  const getCombinedMeasurements = useCallback((): Measurements => {
    if (buildings.length === 0) {
      return {
        total_squares: 0,
        predominant_pitch: '',
        ridge_length: 0,
        hip_length: 0,
        valley_length: 0,
        eave_length: 0,
        rake_length: 0,
        penetrations: 0,
        skylights: 0,
        chimneys: 0,
        complexity: '',
      };
    }
    const combined = buildings.reduce(
      (acc, b) => {
        const m = b.measurements;
        return {
          total_squares: acc.total_squares + (m.total_squares ?? 0),
          ridge_length: acc.ridge_length + (m.ridge_length ?? 0),
          hip_length: acc.hip_length + (m.hip_length ?? 0),
          valley_length: acc.valley_length + (m.valley_length ?? 0),
          eave_length: acc.eave_length + (m.eave_length ?? 0),
          rake_length: acc.rake_length + (m.rake_length ?? 0),
          penetrations: acc.penetrations + (m.penetrations ?? 0),
          skylights: acc.skylights + (m.skylights ?? 0),
          chimneys: acc.chimneys + (m.chimneys ?? 0),
        };
      },
      {
        total_squares: 0,
        ridge_length: 0,
        hip_length: 0,
        valley_length: 0,
        eave_length: 0,
        rake_length: 0,
        penetrations: 0,
        skylights: 0,
        chimneys: 0,
      }
    );
    const first = buildings[0].measurements;
    return {
      ...combined,
      predominant_pitch: first.predominant_pitch ?? '',
      complexity: first.complexity ?? '',
    };
  }, [buildings]);

  return {
    buildings,
    activeBuildingId,
    addBuilding,
    removeBuilding,
    updateBuilding,
    updateBuildingsBatch,
    updateBuildingRoofSystem,
    updateBuildingQuickOption,
    updateBuildingMeasurements,
    toggleBuildingCollapsed,
    allBuildingsHaveRoofSystem,
    getTotalSquares,
    getCombinedMeasurements,
  };
}
