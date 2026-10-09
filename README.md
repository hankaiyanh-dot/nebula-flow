# 星云流 · Nebula Flow v1.5.0

Six flowing particle universes. An offline, self-contained Canvas 2D artwork with comet tails, ripples and continuous drag repulsion.

**Play online:** https://hankaiyanh-dot.github.io/nebula-flow/

GitHub Pages is publicly available and tested at its HTTPS address. The itch.io project is currently a draft blocked by account email verification. The Wallpaper Engine Workshop upload is held pending final real desktop input acceptance. See `docs/RELEASE-STATUS.md`.

六种持续流动的粒子宇宙：自然星云、极光长流、深空尘埃、星环轨道、旋涡风暴、超新星。轻点产生光波，按住拖动向路径两侧拨开星点。

Open `index.html` in a browser. Expand the glass controls at the upper right to select a scene, adjust settings or enter fullscreen. Keyboard: 1–6 scenes, Space pause, Esc close controls. Touch devices support tap and swipe; physical mobile compatibility depends on the browser and device.

`src/` contains the shared core. `web/` is the GitHub Pages build; `NebulaFlow_v1.5.0_itch.zip` contains a root `index.html` for itch.io. `wallpaper/` contains the Wallpaper Engine project and all 16 native properties. Native HTML settings route to Wallpaper Engine's property panel to avoid a previously reproduced CEF form crash path. No frameworks or online runtime dependencies.

The original v1.5.0 production project and local diagnostic evidence are preserved separately. Historical native stability and fullscreen checks are reused because the particle core and native HTML remain unchanged. Final native desktop interaction regression is still pending; availability of a local project does not mean a Workshop release passed its gate.

Publication status and tested scope are recorded separately in `docs/RELEASE-STATUS.md`. No blanket claim of compatibility with all devices.
