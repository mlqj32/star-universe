/** 可进入探索的区域：仅含已建模真实恒星系 / 系外行星 */
export const COSMIC_REGIONS = [
  {
    id: 'milkyway',
    name: '银河系',
    navItemId: 'milkyway',
    origin: [0, 0, 0],
    useBuiltinSystems: true,
    overviewSpread: 65000,
    desc: '太阳系及 27 个已证认恒星系，均含真实历元轨道与系外行星数据。',
  },
];

export function getCosmicRegion(id) {
  return COSMIC_REGIONS.find((r) => r.id === id) ?? null;
}

export function getRegionByNavItem(navItemId) {
  return COSMIC_REGIONS.find((r) => r.navItemId === navItemId) ?? null;
}

export function isEnterableRegion(navItemId) {
  return navItemId === 'milkyway';
}

export function getSystemWorldPos(sys, regionId = sys.regionId) {
  if (sys.builtIn) return [22000, 120, 6000];
  const region = getCosmicRegion(regionId || 'milkyway');
  if (!region) return sys.galaxyPos || sys.localPos || [0, 0, 0];
  if (region.useBuiltinSystems) return sys.galaxyPos;
  const origin = region.origin;
  const local = sys.localPos || [0, 0, 0];
  return [origin[0] + local[0], origin[1] + local[1], origin[2] + local[2]];
}

export function getRegionSystems(region) {
  if (!region) return [];
  if (region.useBuiltinSystems) return null;
  return region.systems || [];
}

export function getExoBuildList(builtinSystems) {
  const list = [];
  for (const region of COSMIC_REGIONS) {
    if (region.useBuiltinSystems) {
      (builtinSystems || []).filter((s) => !s.builtIn).forEach((sys) => {
        list.push({ sys: { ...sys, regionId: region.id }, worldPos: sys.galaxyPos, regionId: region.id });
      });
    }
  }
  return list;
}

export function getRegionOverviewEntries(region, builtinSystems) {
  if (!region) return [];
  if (region.useBuiltinSystems) {
    return (builtinSystems || []).map((sys) => ({
      sys: { ...sys, regionId: region.id },
      worldPos: sys.builtIn ? [22000, 120, 6000] : sys.galaxyPos,
    }));
  }
  return [];
}

export function formatRegionDistance(region) {
  if (region?.distanceMly) return `约 ${region.distanceMly} Mly`;
  return '';
}

export function formatSystemDistance(sys) {
  if (sys.distanceLy != null) return `${sys.distanceLy} ly`;
  return '';
}
