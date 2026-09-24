# Claude Code 使用说明

把整个文件夹交给 Claude Code，并明确：
- `reference/desktop-reference.svg` 和 `reference/mobile-reference.svg` 是结构化参考，比截图优先级更高。
- SVG 里的 x/y/width/height/font-size/rx/color 可以直接当作布局与视觉参数读取。
- `spec/content.json` 是唯一文案源，不从图片 OCR。
- `spec/design-tokens.json` 是统一颜色与尺寸源。
- `assets/radar-mascot.svg` 是 Hero 插画，直接使用，不要重画。
- `assets/hero-underline.svg` 直接使用。
- 所有卡片、文字、数字、FAQ、列表都必须用 HTML/CSS 实现，不能整页贴图。
- 完成后截图 1440×900 和 390×844，与 reference PNG/SVG 对照继续修正。

一句话要求：
“不要根据截图猜布局，优先读取 SVG 的真实坐标与尺寸；不要重新设计，只做高还原实现。”
