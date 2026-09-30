# Grounding data gallery

**Browse it:** https://uwgzq.github.io/grounding-data-gallery/

Five training examples per dataset for the `ground_qwen3_5` grounding mixtures, with a dropdown to pick the dataset.

- **Image datasets (32):** the `full_v3` mixture (19), GoldG Flickr30k / GQA and RF100, the hero-mixture additions (COCONut-Objects365, EntitySeg), and the `full_v5` candidates (GPIC, iNat21). Each example shows the image, the same image with its masks and labels drawn on it, and the text the model reads.
- **Video datasets (21):** the `video_full_v2` mixture. Each example has an overlay video (masks, instance numbers, legend with per-instance presence, and the action timeline where the dataset has actions), the original video, an 8-frame contact sheet, and the text the model reads.

Every example also links its `meta.json`: dataset row, instance labels and character spans, frame presence, actions, and consistency checks. Absolute cluster paths in `meta.json` were rewritten to be relative to the data root.

Link to one dataset with its name as the hash, for example `#coconut_refexp`. The left and right arrow keys step through datasets.

## Layout

```
index.html, assets/        static page (no build step, no dependencies)
manifest.json              dataset list, dropdown sections, per-example summary
data/<dataset>/NN_*        media and meta.json for example NN
```

Overlay stills are WebP (quality 90). Stills whose longest side is over 2560 px were downscaled to 2560.

## Licence of the media

Images and videos come from their source datasets (COCO / COCONut, LVIS, ADE20K, PixMo, SA-1B, Flickr30k, GQA, Roboflow 100, Objects365, EntitySeg, GPIC, iNat21, ViCaS, SA-FARI, LV-VIS, BURST, OVIS, YouTube-VIS, VIPOSeg, ReVOS, Ref-YouTube-VOS) and remain under those datasets' terms. They are shown here as a research preview only.
