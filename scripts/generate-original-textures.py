"""Generate original equirectangular planet maps; no photographic source images."""

from pathlib import Path
import sys
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "textures" / "original"
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1024, 512
Y, X = np.mgrid[0:H, 0:W]
LAT = (Y / H - .5) * np.pi

PALETTES = {
    "cangyan": ((16, 62, 90), (37, 121, 132), (73, 145, 105), (198, 215, 202)),
    "shendu": ((10, 49, 75), (31, 126, 139), (83, 164, 112), (238, 224, 165)),
    "lumila": ((35, 80, 124), (51, 153, 164), (90, 164, 105), (231, 177, 209)),
    "tilanno": ((29, 70, 82), (100, 135, 146), (56, 102, 79), (207, 218, 191)),
    "fudisi": ((38, 70, 106), (93, 149, 172), (176, 93, 79), (220, 214, 205)),
    "aierse": ((25, 66, 88), (59, 142, 141), (78, 133, 107), (216, 220, 209)),
    "baixi": ((34, 81, 102), (110, 157, 165), (139, 170, 121), (225, 221, 186)),
    "yaoxian": ((32, 45, 88), (77, 101, 154), (141, 108, 159), (215, 189, 196)),
    "lufeyin": ((56, 39, 65), (142, 77, 86), (198, 138, 115), (229, 200, 160)),
    "diya": ((27, 42, 71), (73, 115, 158), (119, 155, 180), (219, 225, 223)),
    "lailer": ((34, 29, 48), (72, 57, 93), (108, 88, 121), (186, 164, 177)),
    "nokdun": ((23, 43, 67), (58, 79, 117), (73, 65, 99), (165, 175, 195)),
    "lijin": ((30, 29, 37), (75, 53, 48), (136, 83, 64), (200, 143, 95)),
    "shuanghui": ((29, 50, 64), (70, 99, 115), (139, 177, 187), (217, 231, 230)),
    "qingmu": ((23, 56, 68), (52, 107, 120), (107, 155, 158), (191, 207, 194)),
    "noktia": ((33, 26, 51), (79, 64, 111), (111, 95, 143), (176, 165, 186)),
    "mirfa": ((46, 34, 40), (96, 63, 74), (142, 96, 104), (196, 168, 172)),
    "lusete": ((48, 36, 68), (98, 74, 128), (153, 124, 175), (214, 197, 222)),
    "kachi": ((41, 39, 45), (91, 65, 66), (152, 84, 69), (198, 144, 113)),
    "dumoen": ((24, 65, 71), (54, 115, 117), (64, 91, 78), (159, 187, 158)),
    "yanwen": ((30, 31, 39), (76, 53, 51), (147, 91, 70), (205, 151, 113)),
    "lanman": ((31, 51, 80), (63, 95, 130), (105, 143, 168), (196, 210, 215)),
    "yanjing": ((77, 76, 80), (130, 122, 113), (195, 189, 171), (233, 226, 207)),
    "suhan": ((34, 55, 65), (67, 95, 107), (143, 179, 188), (215, 227, 225)),
    "viskar": ((28, 55, 82), (77, 126, 158), (93, 133, 112), (192, 202, 196)),
    "xuanli": ((27, 26, 37), (62, 55, 73), (105, 91, 111), (168, 157, 170)),
    "huike": ((49, 54, 62), (96, 101, 108), (158, 161, 163), (210, 208, 199)),
    "chichao": ((61, 43, 46), (112, 67, 62), (170, 106, 77), (221, 168, 123)),
    "tielan": ((39, 43, 47), (90, 72, 68), (142, 94, 75), (190, 151, 120)),
    "venus": ((111, 100, 85), (172, 151, 119), (212, 190, 149), (240, 221, 182)),
    "mars": ((54, 48, 47), (109, 69, 57), (168, 92, 65), (213, 151, 105)),
    "jupiter": ((68, 62, 66), (138, 108, 91), (201, 167, 135), (233, 218, 188)),
    "mercury": ((47, 49, 53), (91, 93, 96), (145, 143, 138), (197, 193, 181)),
    "saturn": ((88, 76, 65), (155, 133, 104), (207, 184, 144), (230, 216, 181)),
    "uranus": ((39, 92, 105), (82, 154, 165), (147, 205, 207), (202, 229, 223)),
    "neptune": ((21, 48, 103), (40, 76, 151), (72, 116, 191), (147, 187, 216)),
}


def noise(rng, scales):
    total = np.zeros((H, W), dtype=np.float32)
    weight = 0
    for cols, rows, amplitude in scales:
        # The extra column is a periodic copy, giving the sphere a clean seam.
        sample = rng.random((rows + 1, cols), dtype=np.float32)
        sample[:, -1] = sample[:, 0]
        layer = Image.fromarray(np.uint8(sample * 255), "L").resize((W, H), Image.Resampling.BICUBIC)
        total += np.asarray(layer, dtype=np.float32) / 255 * amplitude
        weight += amplitude
    return total / weight


targets = set(sys.argv[1:])
for seed, (name, palette) in enumerate(PALETTES.items(), 17):
    if targets and name not in targets:
        continue
    rng = np.random.default_rng(seed)
    continents = noise(rng, [(7, 4, .7), (17, 9, .22), (45, 22, .08)])
    detail = noise(rng, [(19, 9, .5), (58, 29, .3), (145, 73, .2)])
    stripes = .035 * np.sin(LAT * (10 + seed % 5) + detail * 10)
    elevation = continents + stripes + .09 * (detail - .5)
    polar = np.abs(np.sin(LAT))
    ocean, shallow, land, highlight = [np.array(c, dtype=np.float32) for c in palette]
    image = np.zeros((H, W, 3), dtype=np.float32)
    if name == "shendu":
        waterLevel, coastLevel = .535, .565
    else:
        waterLevel, coastLevel = .51, .55
    water = elevation < waterLevel
    coast = (elevation >= waterLevel) & (elevation < coastLevel)
    image[water] = ocean + (shallow - ocean) * np.clip((elevation[water] - .30) / (waterLevel - .30), 0, 1)[:, None]
    image[coast] = shallow[None, :] * .6 + land[None, :] * .4
    upland = elevation >= coastLevel
    ridge = np.clip((elevation[upland] - coastLevel) / .28, 0, 1)
    image[upland] = land + (highlight - land) * ridge[:, None]
    ice = np.clip((polar - .82) * 5.3, 0, 1)
    if name not in ("lufeyin", "diya"):
        image = image * (1 - ice[:, :, None] * .83) + np.array([226, 231, 231]) * ice[:, :, None] * .83
    else:
        cracks = np.abs(np.sin(X * .047 + detail * 25) * np.sin(Y * .063 - detail * 18))
        fissure = (cracks < .07) & (elevation > .48)
        image[fissure] = highlight * .8 + np.array([16, 16, 24]) * .2
    if name == "lumila":
        cloud = (detail > .68) & (polar < .8)
        image[cloud] = image[cloud] * .67 + np.array([244, 180, 216]) * .33
    if name == "yaoxian":
        lights = (detail > .74) & (elevation > .56)
        image[lights] = image[lights] * .6 + np.array([250, 198, 120]) * .4
    if name == "shendu":
        # 圣都的生态与航路设施共生：金色航站灯带、花园群岛与高纬云层，
        # 通过连续噪声和经纬度带叠加，避免出现贴图上的规则图标。
        longitude = X / W * np.pi * 2 - np.pi
        latitude = LAT
        gardenBelts = (
            np.exp(-((latitude - .28) / .16) ** 2)
            + np.exp(-((latitude + .43) / .13) ** 2)
        ) * (detail * .68 + .32)
        gardenMask = (elevation > .49) & (gardenBelts > .34)
        gardenColor = np.array([94, 188, 130], dtype=np.float32)
        image[gardenMask] = image[gardenMask] * .48 + gardenColor * .52
        stationRibbons = (
            (np.sin(longitude * 3.2 + detail * 8.0) > .985)
            & (elevation > .56)
            & (detail > .63)
        )
        image[stationRibbons] = image[stationRibbons] * .72 + np.array([244, 210, 128]) * .28
        cloudBands = (np.sin(latitude * 15.0 + detail * 5.0) > .84) & (polar < .86)
        image[cloudBands] = image[cloudBands] * .88 + np.array([210, 238, 225]) * .12
        # Longitude collapses to one point at each pole; smooth the source rows
        # so the map does not form radial wedges on the rendered sphere.
        polarRows = 42
        northColor = image[:4].mean(axis=(0, 1))
        southColor = image[-4:].mean(axis=(0, 1))
        for row in range(polarRows):
            blend = (row / polarRows) ** 2
            image[row] = northColor * (1 - blend) + image[row] * blend
            image[-row - 1] = southColor * (1 - blend) + image[-row - 1] * blend
    if name == "lijin":
        rock = np.clip((elevation - .32) * 1.9, 0, 1)
        ash = np.array([37, 38, 45], dtype=np.float32)
        rust = np.array([164, 102, 73], dtype=np.float32)
        image = ash[None, None, :] * (1 - rock[:, :, None]) + rust[None, None, :] * rock[:, :, None]
        basins = (detail < .38) & (continents < .55)
        image[basins] *= .55
        ridges = (detail > .68) & (continents > .53)
        image[ridges] = image[ridges] * .7 + np.array([218, 161, 114]) * .3
    if name == "shuanghui":
        ice = np.clip((elevation - .34) * 2.2, 0, 1)
        dark = np.array([38, 67, 83], dtype=np.float32)
        bright = np.array([190, 219, 222], dtype=np.float32)
        image = dark[None, None, :] * (1 - ice[:, :, None]) + bright[None, None, :] * ice[:, :, None]
        fractures = np.abs(np.sin(X * .034 + detail * 18) * np.cos(Y * .047 - detail * 14)) < .052
        image[fractures] *= .55
    if name == "qingmu":
        latitude = LAT
        waviness = .22 * np.sin(X * .025 + detail * 11)
        bands = np.sin(latitude * 22 + waviness + detail * 4)
        bandMix = np.clip((bands + 1) * .5, 0, 1)
        deep = np.array([39, 78, 91], dtype=np.float32)
        pale = np.array([148, 187, 179], dtype=np.float32)
        image = deep[None, None, :] * (1 - bandMix[:, :, None]) + pale[None, None, :] * bandMix[:, :, None]
        storm = np.exp(-((X - W * .69) / (W * .075)) ** 2 - ((Y - H * .38) / (H * .055)) ** 2)
        image = image * (1 - storm[:, :, None] * .55) + np.array([202, 203, 172]) * storm[:, :, None] * .55
        polarBlend = np.clip((polar - .72) * 3.6, 0, 1)
        polarColor = np.array([66, 103, 112], dtype=np.float32)
        image = image * (1 - polarBlend[:, :, None]) + polarColor * polarBlend[:, :, None]
    if name == "yanwen":
        rock = np.clip((elevation - .31) * 2.0, 0, 1)
        image = np.array([42, 39, 44]) * (1 - rock[:, :, None]) + np.array([184, 113, 82]) * rock[:, :, None]
        basins = (continents < .43) & (detail < .55)
        image[basins] *= .62
        ridges = (continents > .59) & (detail > .56)
        image[ridges] = image[ridges] * .76 + np.array([214, 165, 124]) * .24
    if name == "lanman":
        longitude = X / W * np.pi * 2
        bands = np.sin(LAT * 25 + .3 * np.sin(longitude * 6) + detail * 3.5)
        blend = np.clip((bands + 1) * .5, 0, 1)
        image = np.array([49, 75, 112])[None, None, :] * (1 - blend[:, :, None]) + np.array([154, 184, 200])[None, None, :] * blend[:, :, None]
        storm = np.exp(-((X - W * .34) / (W * .09)) ** 2 - ((Y - H * .56) / (H * .05)) ** 2)
        image = image * (1 - storm[:, :, None] * .47) + np.array([214, 217, 207]) * storm[:, :, None] * .47
    if name == "yanjing":
        mineral = np.clip((elevation - .3) * 2.1, 0, 1)
        image = np.array([91, 88, 91])[None, None, :] * (1 - mineral[:, :, None]) + np.array([223, 213, 189])[None, None, :] * mineral[:, :, None]
        flats = (continents > .47) & (detail < .48)
        image[flats] = image[flats] * .66 + np.array([237, 231, 216]) * .34
        faults = (np.abs(continents - .49 + .1 * (detail - .5)) < .012) & (detail < .57)
        image[faults] *= .73
    if name == "suhan":
        frost = np.clip((elevation - .3) * 2.3, 0, 1)
        image = np.array([49, 70, 78])[None, None, :] * (1 - frost[:, :, None]) + np.array([206, 220, 218])[None, None, :] * frost[:, :, None]
        fractures = (np.abs(np.sin(X * .027 + detail * 15) * np.cos(Y * .049 - detail * 11)) < .045) & (continents < .63)
        image[fractures] *= .56
    if name == "viskar":
        # Ice follows latitude and elevation, leaving open seas and habitable lowland.
        latitudeIce = np.clip((polar - .40) * 2.2, 0, 1)
        mountainSnow = np.clip((elevation - .59) * 7.0, 0, .85) * upland
        snow = np.maximum(latitudeIce, mountainSnow)
        image = image * (1 - snow[:, :, None]) + np.array([224, 240, 246]) * snow[:, :, None]
        longitude = X / W * np.pi * 2
        latitude = LAT
        grid = (np.abs(np.sin(longitude * 18 + detail * 3)) < .024) | (np.abs(np.sin(latitude * 21 + detail * 2)) < .018)
        grid &= (detail > .57) & upland & (polar < .70)
        image[grid] = image[grid] * .58 + np.array([110, 207, 235]) * .42
        city = (detail > .78) & upland & (polar < .55)
        image[city] = image[city] * .58 + np.array([155, 229, 247]) * .42
    if name == "xuanli":
        rock = np.clip((elevation - .34) * 2.0, 0, 1)
        image = np.array([35, 33, 45])[None, None, :] * (1 - rock[:, :, None]) + np.array([130, 112, 135])[None, None, :] * rock[:, :, None]
        craters = (continents < .43) & (detail < .47)
        image[craters] *= .66
        frost = np.clip((polar - .72) * 2.5, 0, .35)
        image = image * (1 - frost[:, :, None]) + np.array([181, 183, 193]) * frost[:, :, None]
    if name == "huike":
        mineral = np.clip((elevation - .32) * 2.0, 0, 1)
        image = np.array([64, 71, 81])[None, None, :] * (1 - mineral[:, :, None]) + np.array([197, 197, 191])[None, None, :] * mineral[:, :, None]
        basins = (continents < .46) & (detail < .42)
        image[basins] *= .72
        ejecta = (np.abs(continents - .46) < .023) & (detail > .54)
        image[ejecta] = image[ejecta] * .74 + np.array([220, 215, 202]) * .26
    if name == "chichao":
        longitude = X / W * np.pi * 2
        bands = np.sin(LAT * 18 + .45 * np.sin(longitude * 5) + detail * 4)
        blend = np.clip((bands + 1) * .5, 0, 1)
        image = np.array([96, 52, 55])[None, None, :] * (1 - blend[:, :, None]) + np.array([197, 137, 94])[None, None, :] * blend[:, :, None]
        storm = np.exp(-((X - W * .63) / (W * .085)) ** 2 - ((Y - H * .42) / (H * .065)) ** 2)
        image = image * (1 - storm[:, :, None] * .68) + np.array([64, 51, 56]) * storm[:, :, None] * .68
    if name == "tielan":
        iron = np.clip((elevation - .29) * 2.0, 0, 1)
        image = np.array([49, 57, 61])[None, None, :] * (1 - iron[:, :, None]) + np.array([177, 112, 82])[None, None, :] * iron[:, :, None]
        veins = (np.abs(continents - .51 + .08 * (detail - .5)) < .013) & (detail < .58)
        image[veins] *= .65
        highlands = (continents > .61) & (detail > .56)
        image[highlands] = image[highlands] * .73 + np.array([211, 158, 112]) * .27
    if name == "venus":
        swirls = np.sin(LAT * 17 + detail * 10 + .6 * np.sin(X * .013 + LAT * 4))
        blend = np.clip((swirls + 1) * .5, 0, 1)
        image = np.array([160, 139, 111])[None, None, :] * (1 - blend[:, :, None]) + np.array([229, 211, 174])[None, None, :] * blend[:, :, None]
        image += ((continents - .5) * 33)[:, :, None]
    if name == "mars":
        rust = np.clip((elevation - .28) * 2.0, 0, 1)
        image = np.array([79, 55, 51])[None, None, :] * (1 - rust[:, :, None]) + np.array([193, 108, 70])[None, None, :] * rust[:, :, None]
        darkPlains = (continents < .43) & (detail < .58)
        image[darkPlains] *= .7
        polarIce = np.clip((polar - .96) * 25, 0, 1)
        image = image * (1 - polarIce[:, :, None]) + np.array([216, 209, 192]) * polarIce[:, :, None]
    if name == "jupiter":
        flow = .42 * np.sin(X * .019 + detail * 8) + .18 * np.sin(X * .047 - detail * 13)
        bands = np.sin(LAT * 27 + flow + detail * 3.5)
        blend = np.clip((bands + 1) * .5, 0, 1)
        image = np.array([151, 122, 107])[None, None, :] * (1 - blend[:, :, None]) + np.array([224, 203, 177])[None, None, :] * blend[:, :, None]
        spot = np.exp(-((X - W * .67) / (W * .078)) ** 2 - ((Y - H * .58) / (H * .058)) ** 2)
        image = image * (1 - spot[:, :, None] * .83) + np.array([161, 87, 69]) * spot[:, :, None] * .83
        polarBlend = np.clip((polar - .78) * 3.5, 0, .6)
        image = image * (1 - polarBlend[:, :, None]) + np.array([177, 163, 149]) * polarBlend[:, :, None]
    if name == "mercury":
        mineral = np.clip((elevation - .31) * 2, 0, 1)
        image = np.array([69, 71, 74])[None, None, :] * (1 - mineral[:, :, None]) + np.array([167, 161, 150])[None, None, :] * mineral[:, :, None]
        craters = (continents < .46) & (detail < .46)
        image[craters] *= .62
        ejecta = (np.abs(continents - .46) < .025) & (detail > .53)
        image[ejecta] = image[ejecta] * .77 + np.array([215, 205, 187]) * .23
    if name == "saturn":
        longitude = X / W * np.pi * 2
        bands = np.sin(LAT * 23 + .16 * np.sin(longitude * 5) + detail * 2.8)
        blend = np.clip((bands + 1) * .5, 0, 1)
        image = np.array([146, 124, 101])[None, None, :] * (1 - blend[:, :, None]) + np.array([222, 203, 166])[None, None, :] * blend[:, :, None]
        polarBlend = np.clip((polar - .78) * 3.4, 0, .65)
        image = image * (1 - polarBlend[:, :, None]) + np.array([166, 153, 132]) * polarBlend[:, :, None]
    if name == "uranus":
        hazes = np.clip((detail - .5) * .45 + .12 * np.sin(LAT * 11 + X * .009), -.16, .16)
        image = np.array([138, 196, 201])[None, None, :] + hazes[:, :, None] * np.array([105, 125, 115])
        polarBlend = np.clip((polar - .67) * 2.6, 0, .65)
        image = image * (1 - polarBlend[:, :, None]) + np.array([194, 218, 216]) * polarBlend[:, :, None]
    if name == "neptune":
        longitude = X / W * np.pi * 2
        belts = np.sin(LAT * 18 + .26 * np.sin(longitude * 6) + detail * 3.5)
        blend = np.clip((belts + 1) * .5, 0, 1)
        image = np.array([31, 64, 133])[None, None, :] * (1 - blend[:, :, None]) + np.array([89, 137, 193])[None, None, :] * blend[:, :, None]
        storm = np.exp(-((X - W * .62) / (W * .065)) ** 2 - ((Y - H * .41) / (H * .052)) ** 2)
        image = image * (1 - storm[:, :, None] * .7) + np.array([25, 51, 103]) * storm[:, :, None] * .7
        polarBlend = np.clip((polar - .79) * 3.2, 0, .55)
        image = image * (1 - polarBlend[:, :, None]) + np.array([58, 98, 162]) * polarBlend[:, :, None]
    if name in ("yanwen", "lanman", "yanjing", "suhan", "xuanli", "huike", "chichao", "tielan", "venus", "mars", "jupiter", "mercury", "saturn", "uranus", "neptune"):
        poleRows = 30
        northColor = image[:4].mean(axis=(0, 1))
        southColor = image[-4:].mean(axis=(0, 1))
        for row in range(poleRows):
            blend = (row / poleRows) ** 2
            image[row] = northColor * (1 - blend) + image[row] * blend
            image[-row - 1] = southColor * (1 - blend) + image[-row - 1] * blend
    Image.fromarray(np.uint8(np.clip(image, 0, 255)), "RGB").save(OUT / f"{name}.png", optimize=True)
    print(name)
