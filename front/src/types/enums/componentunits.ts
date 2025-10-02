import { enumToArray } from './contactType';

/**
 * Типы единиц измерения
 */
export enum ComponentTypeUnit {
  VOLUME = 'VOLUME',
  WEIGHT = 'WEIGHT',
  ENERGY_VALUE = 'ENERGY_VALUE',
}

/**
 * Список единиц измерения в группе "объём"
 */
export enum UnitVolume {
  ML = 'ML',
  FLOZ = 'FLOZ',
}

/**
 * Список единиц измерения в группе "масса"
 */
export enum UnitWeight {
  MCG = 'MCG',
  MG = 'MG',
  G = 'G',
  KG = 'KG',
  OZ = 'OZ',
}

/**
 * Список единиц измерения в группе "энергитическая ценность"
 */
export enum UnitEnergyValue {
  KCAL = 'KCAL',
  KJ = 'KJ',
}

/**
 * enum для единицы измерения количества на которое указан состав
 */
export enum ComponentsUnit {
  G = 'G',
  ML = 'ML',
}

/**
 * Объединяющий тип для упрощения типизации в компонентах
 */
export type UnionUnitType = UnitVolume | UnitWeight | UnitEnergyValue;

/**
 * Список типов единиц измерения
 */
export const componentTypeUnitList = enumToArray(ComponentTypeUnit) as ComponentTypeUnit[];

/**
 * Список объёмных единиц измерения
 */
export const componentUnitVolumeList = enumToArray(UnitVolume) as UnitVolume[];

/**
 * Список весовых единиц измерения
 */
export const componentUnitWeight = enumToArray(UnitWeight) as UnitWeight[];

/**
 * Список энергитических единич измерения
 */
export const componentUnitEnergyValue = enumToArray(UnitEnergyValue) as UnitEnergyValue[];
