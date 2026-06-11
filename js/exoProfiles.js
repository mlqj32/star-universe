/** 系外行星详细信息（与太阳系 profile 字段一致） */

function travel(ly) {
  if (ly <= 0) return '约 3 天（近地轨道）';
  if (ly < 15) {
    const a = Math.round(ly * 18);
    const b = Math.round(ly * 35);
    return `约 ${a}～${b} 年（亚光速 3%～5% c 设想）`;
  }
  if (ly < 100) {
    const a = Math.round(ly * 15);
    const b = Math.round(ly * 30);
    return `约 ${a}～${b} 年（世代飞船设想）`;
  }
  if (ly < 1000) {
    const a = Math.round(ly * 0.9);
    const b = Math.round(ly * 1.8);
    return `约 ${a}～${b} 千年（光速 1%～2% 设想）`;
  }
  const a = Math.round(ly * 0.7);
  const b = Math.round(ly * 1.4);
  return `约 ${a}～${b} 千年（光速 10% 极限设想）`;
}

const T = {
  hotRocky: {
    life: '无已知生命',
    habitability: '极低（潮汐锁定 / 辐射轰击）',
    difficulty: '9 / 10',
    surface: '岩石行星，极可能潮汐锁定',
    atmosphere: '稀薄或已剥离，成分未知',
    temperature: '向阳面约 200～800°C',
  },
  hzRocky: {
    life: '无已知生命（宜居带候选）',
    habitability: '中等 · 候选宜居',
    difficulty: '8 / 10',
    surface: '岩石行星，可能存在液态水',
    atmosphere: '成分未知，可能含氮/二氧化碳',
    temperature: '估算 -30～50°C（取决于大气）',
  },
  superEarth: {
    life: '无已知生命',
    habitability: '低至中等（超级地球）',
    difficulty: '8 / 10',
    surface: '岩石行星，高表面重力',
    atmosphere: '可能浓厚，成分待确认',
    temperature: '估算 -20～120°C',
  },
  hotNeptune: {
    life: '无已知生命',
    habitability: '不可居住',
    difficulty: '9 / 10',
    surface: '迷你海王星 / 气体包裹岩石核',
    atmosphere: '厚氢氦或水蒸气大气',
    temperature: '约 300～700°C',
  },
  gasGiant: {
    life: '无已知生命',
    habitability: '不可居住（气态巨行星）',
    difficulty: '9 / 10',
    surface: '气态巨行星，无固体表面',
    atmosphere: '氢、氦为主，可能含甲烷',
    temperature: '云顶层约 -150～-50°C',
  },
  coldGiant: {
    life: '无已知生命',
    habitability: '不可居住',
    difficulty: '9 / 10',
    surface: '冷木星 / 气态巨行星',
    atmosphere: '氢、氦为主',
    temperature: '云顶层约 -180～-80°C',
  },
  iceWorld: {
    life: '无已知生命',
    habitability: '极低',
    difficulty: '8 / 10',
    surface: '岩石/冰混合，低温世界',
    atmosphere: '稀薄或冰冻大气',
    temperature: '约 -200～-80°C',
  },
};

/** systemId:planetId → profile */
export const EXO_PROFILES = {
  // 比邻星
  'proxima:proxima_d': { ...T.hotRocky, travelTime: travel(4.24), temperature: '约 80～200°C', difficulty: '8 / 10' },
  'proxima:proxima_b': { life: '无已知生命（宜居带候选）', habitability: '中等 · 地球2.0候选', difficulty: '8 / 10', travelTime: travel(4.24), surface: '岩石行星，潮汐锁定可能', temperature: '估算 -39°C（无大气模型）', atmosphere: '可能稀薄或缺乏保护性大气' },
  'proxima:proxima_c': { ...T.iceWorld, travelTime: travel(4.24), surface: '低温超级地球 / 迷你海王星候选', temperature: '约 -230°C', atmosphere: '可能极稀薄' },

  // 南门二
  'alpha_cen:alpha_cen_b': { ...T.hotRocky, travelTime: travel(4.37), temperature: '约 1200°C（极近恒星）', difficulty: '9 / 10' },

  // 波江座 ε
  'eps_eridani:ae_gir': { ...T.gasGiant, travelTime: travel(10.5), temperature: '云顶层约 -100～-50°C', difficulty: '8 / 10', surface: '气态巨行星 AEgir，质量约 0.78 木星' },

  // 罗斯 128
  'ross128:ross128b': { ...T.hzRocky, travelTime: travel(11), habitability: '中等偏高 · 宜居带岩石行星', temperature: '估算 -60～20°C' },

  // 天仓五
  'tau_ceti:tau_g': { ...T.hotRocky, travelTime: travel(11.9), temperature: '约 200°C' },
  'tau_ceti:tau_e': { ...T.superEarth, travelTime: travel(11.9), habitability: '低（高椭圆轨道）', temperature: '约 -40～100°C' },
  'tau_ceti:tau_f': { ...T.gasGiant, travelTime: travel(11.9), surface: '气态巨行星候选', temperature: '约 -120°C' },

  // 沃夫 1061
  'wolf1061:wolf_b': { ...T.hotRocky, travelTime: travel(13.8) },
  'wolf1061:wolf_c': { ...T.hzRocky, travelTime: travel(13.8), habitability: '中等 · 宜居带内侧' },
  'wolf1061:wolf_d': { ...T.superEarth, travelTime: travel(13.8), habitability: '低至中等（较冷）', temperature: '约 -50～10°C' },

  // 格利泽 876
  'gliese876:gj876d': { ...T.hotRocky, travelTime: travel(15.2) },
  'gliese876:gj876c': { ...T.gasGiant, travelTime: travel(15.2), surface: '天王星型冰巨行星', temperature: '约 -180°C' },
  'gliese876:gj876b': { ...T.gasGiant, travelTime: travel(15.2), surface: '木星型气态巨行星', temperature: '约 -80°C' },
  'gliese876:gj876e': { ...T.superEarth, travelTime: travel(15.2), habitability: '低' },

  // 格利泽 832
  'gliese832:gj832b': { ...T.superEarth, travelTime: travel(16.2), habitability: '中等（宜居带候选）', temperature: '估算 -10～40°C' },
  'gliese832:gj832c': { ...T.coldGiant, travelTime: travel(16.2), surface: '冷木星，质量约 0.64 木星', temperature: '约 -150°C' },

  // 格利泽 581
  'gliese581:gj581e': { ...T.hotRocky, travelTime: travel(20.3) },
  'gliese581:gj581b': { ...T.hotNeptune, travelTime: travel(20.3), surface: '大型岩石/海洋行星', temperature: '约 400°C' },
  'gliese581:gj581c': { ...T.gasGiant, travelTime: travel(20.3), surface: '海王星型行星（曾争议）', temperature: '约 -50°C' },
  'gliese581:gj581g': { life: '无已知生命（争议候选）', habitability: '中等 · 地球2.0候选', difficulty: '8 / 10', travelTime: travel(20.3), surface: '岩石行星，宜居带内', temperature: '估算 -31～-12°C', atmosphere: '可能维持液态水' },
  'gliese581:gj581d': { ...T.superEarth, travelTime: travel(20.3), habitability: '低（寒冷）', temperature: '约 -90°C' },

  // 格利泽 667 C
  'gliese667c:gj667cb': { ...T.hotRocky, travelTime: travel(23.6) },
  'gliese667c:gj667cc': { ...T.hzRocky, travelTime: travel(23.6), habitability: '中等偏高 · 超级地球宜居带', temperature: '估算 0～50°C' },
  'gliese667c:gj667cf': { ...T.superEarth, travelTime: travel(23.6), habitability: '中等' },
  'gliese667c:gj667cd': { ...T.superEarth, travelTime: travel(23.6), habitability: '低至中等', temperature: '约 -30～30°C' },

  // 格利泽 436
  'gliese436:gj436b': { ...T.hotNeptune, travelTime: travel(33.1), surface: '热海王星，含热冰与蒸汽大气', temperature: '约 440°C', atmosphere: '氢、氦、水蒸气' },

  // TRAPPIST-1
  'trappist1:trappist_b': { ...T.hotRocky, travelTime: travel(40.7), temperature: '约 400°C' },
  'trappist1:trappist_c': { ...T.hotRocky, travelTime: travel(40.7), temperature: '约 225°C' },
  'trappist1:trappist_d': { ...T.hzRocky, travelTime: travel(40.7), habitability: '中等（宜居带边缘）', temperature: '约 100°C' },
  'trappist1:trappist_e': { ...T.hzRocky, travelTime: travel(40.7), habitability: '中等偏高 · 宜居带', temperature: '估算 -10～30°C' },
  'trappist1:trappist_f': { ...T.hzRocky, travelTime: travel(40.7), habitability: '中等 · 宜居带', temperature: '约 -65～-50°C' },
  'trappist1:trappist_g': { ...T.hzRocky, travelTime: travel(40.7), habitability: '中等（较冷宜居带）', temperature: '约 -110°C' },
  'trappist1:trappist_h': { ...T.iceWorld, travelTime: travel(40.7), temperature: '约 -160°C' },

  // LHS 1140
  'lhs1140:lhs1140b': { ...T.superEarth, travelTime: travel(41), habitability: '中等（厚大气候选）', surface: '超级地球，可能有浓厚大气', temperature: '约 -10～30°C', atmosphere: '可能以氮/二氧化碳为主' },

  // HD 40307
  'hd40307:hd40307b': { ...T.hotRocky, travelTime: travel(42) },
  'hd40307:hd40307c': { ...T.hotRocky, travelTime: travel(42), temperature: '约 277°C' },
  'hd40307:hd40307d': { ...T.superEarth, travelTime: travel(42) },
  'hd40307:hd40307g': { ...T.hzRocky, travelTime: travel(42), habitability: '中等 · 宜居带超级地球', temperature: '约 -20～30°C' },

  // 格利泽 1214
  'gj1214:gj1214b': { ...T.hotNeptune, travelTime: travel(48), surface: '迷你海王星，富含水蒸气', temperature: '约 393°C' },

  // 格利泽 163
  'gliese163:gj163b': { ...T.superEarth, travelTime: travel(49.4), habitability: '低' },
  'gliese163:gj163c': { ...T.hzRocky, travelTime: travel(49.4), habitability: '中等 · 宜居带超级地球', temperature: '约 60°C（可能过热）' },
  'gliese163:gj163d': { ...T.superEarth, travelTime: travel(49.4), habitability: '低至中等', temperature: '约 -10～20°C' },

  // 开普勒-1649
  'kepler1649:kepler1649b': { ...T.hzRocky, travelTime: travel(301), habitability: '中等 · 近星宜居带', difficulty: '10 / 10' },

  // 开普勒-296
  'kepler296:kepler296d': { ...T.hotRocky, travelTime: travel(737), difficulty: '10 / 10' },
  'kepler296:kepler296e': { ...T.hotRocky, travelTime: travel(737), difficulty: '10 / 10' },
  'kepler296:kepler296b': { ...T.superEarth, travelTime: travel(737), difficulty: '10 / 10' },
  'kepler296:kepler296f': { ...T.superEarth, travelTime: travel(737), difficulty: '10 / 10' },
  'kepler296:kepler296g': { ...T.hzRocky, travelTime: travel(737), habitability: '低至中等', difficulty: '10 / 10' },
  'kepler296:kepler296c': { ...T.superEarth, travelTime: travel(737), habitability: '低', difficulty: '10 / 10' },

  // 开普勒-438
  'kepler438:kepler438b': { ...T.hzRocky, travelTime: travel(473), habitability: '中等偏高 · 岩石宜居带', difficulty: '10 / 10', temperature: '估算 3～27°C（地球类似）' },

  // 开普勒-186
  'kepler186:kepler186b': { ...T.hotRocky, travelTime: travel(582), difficulty: '10 / 10' },
  'kepler186:kepler186c': { ...T.hotRocky, travelTime: travel(582), difficulty: '10 / 10' },
  'kepler186:kepler186d': { ...T.hotRocky, travelTime: travel(582), difficulty: '10 / 10' },
  'kepler186:kepler186e': { ...T.superEarth, travelTime: travel(582), difficulty: '10 / 10' },
  'kepler186:kepler186f': { life: '无已知生命（宜居带候选）', habitability: '中等 · 地球2.0', difficulty: '10 / 10', travelTime: travel(582), surface: '岩石行星，半径约 1.17 地球', temperature: '估算 -85～20°C', atmosphere: '成分未知，可能存在液态水' },

  // 开普勒-22
  'kepler22:kepler22b': { ...T.hzRocky, travelTime: travel(638), habitability: '中等 · 宜居带候选', difficulty: '10 / 10', surface: '可能为海洋/岩石行星，半径约 2.4 地球', temperature: '约 -11°C（平衡温度）' },

  // 开普勒-62
  'kepler62:kepler62b': { ...T.hotRocky, travelTime: travel(1200), difficulty: '10 / 10' },
  'kepler62:kepler62c': { ...T.hotRocky, travelTime: travel(1200), difficulty: '10 / 10' },
  'kepler62:kepler62d': { ...T.superEarth, travelTime: travel(1200), difficulty: '10 / 10' },
  'kepler62:kepler62e': { ...T.hzRocky, travelTime: travel(1200), habitability: '中等 · 宜居带', difficulty: '10 / 10', temperature: '约 -26°C' },
  'kepler62:kepler62f': { ...T.hzRocky, travelTime: travel(1200), habitability: '中等 · 宜居带', difficulty: '10 / 10', surface: '岩石/海洋行星，半径约 1.4 地球', temperature: '约 -65°C' },

  // 开普勒-442
  'kepler442:kepler442b': { ...T.hzRocky, travelTime: travel(1206), habitability: '中等偏高 · 高宜居指数', difficulty: '10 / 10', temperature: '估算适宜液态水' },

  // 开普勒-452
  'kepler452:kepler452b': { life: '无已知生命（宜居带候选）', habitability: '中等偏高 · 地球表哥', difficulty: '10 / 10', travelTime: travel(1402), surface: '岩石行星，半径约 1.63 地球，公转 385 天', temperature: '估算与地球相近', atmosphere: '可能类似地球大气（未知）' },

  // 开普勒-1647
  'kepler1647:kepler1647b': { life: '无已知生命', habitability: '低（环双星气态巨行星，卫星或宜居）', difficulty: '10 / 10', travelTime: travel(3705), surface: '环双星气态巨行星，半径约 22 地球', temperature: '云顶层约 -110°C', atmosphere: '氢、氦为主，可能含甲烷' },
};

export function getExoProfile(systemId, planetId, planet, system) {
  const key = `${systemId}:${planetId}`;
  if (EXO_PROFILES[key]) return EXO_PROFILES[key];

  const ly = system?.distanceLy ?? 100;
  const isGiant = planet.radiusKm > 15000 || planet.a > 1.5;
  const isHot = planet.a < 0.1;
  const base = isGiant ? T.gasGiant : isHot ? T.hotRocky : T.hzRocky;
  return { ...base, travelTime: travel(ly) };
}

export function getExoDesc(planet, system) {
  const type =
    planet.radiusKm > 15000
      ? '气态/冰巨行星'
      : planet.a < 0.1
        ? '近距岩石行星'
        : '系外岩石行星';
  const dist = system.distanceLy != null ? `${system.distanceLy} ly` : '河外';
  return `${system.name}（${dist}）${type}，轨道 ${planet.a} AU，公转 ${planet.period.toFixed(1)} 天。`;
}
