// Prompt yêu cầu Gemini phân tích ảnh biểu đồ và trả về JSON đúng schema trong types/chart.ts.
// Viết bằng tiếng Anh để model bám sát thuật ngữ kỹ thuật; kết quả trả về là JSON thuần.

export const EXTRACTION_PROMPT = `You are a precise chart digitizer. Analyze the attached chart image and output a SINGLE JSON object that reconstructs it faithfully. Reproduce EVERY visible element: panels, inset charts, axes, tick values, all data series (with their exact colors, marker shapes, fill state, line styles), Y and X error bars, horizontal/vertical reference lines, titles, axis labels, and legends.

Output ONLY the JSON. No markdown, no comments, no explanation.

Coordinate system: the top-left of the whole image is (0,0). "plotArea" and "bounds" are pixel rectangles in that image space. Estimate the image width/height from what you see and set document width/height to match the image's pixel dimensions.

JSON shape (TypeScript):
{
  "width": number, "height": number, "background": string,           // background hex, usually "#FFFFFF"
  "defaultFontFamily": string,                                       // best-guess, e.g. "Arial"
  "panels": [ Panel ],
  "freeTexts": [ TextSpec ]
}
Panel = {
  "id": string,
  "title": TextSpec | null,
  "plotArea": {"x","y","width","height"},                           // inner data-drawing rectangle (inside the axes)
  "xAxis": Axis, "yAxis": Axis,
  "series": [ Series ],
  "referenceLines": [ ReferenceLine ],
  "legends": [ Legend ],
  "insets": [ Panel ],                                              // nested inset charts, [] if none
  "showBorder": boolean
}
Axis = { "label": string, "min": number, "max": number, "ticks": [number], "tickFormat": "percent" | "number", "type"?: "linear"|"category" }
  // For an axis showing "0%","10%"... use tickFormat "percent" and put the NUMBER as shown (e.g. 10 for "10%") — do NOT divide by 100.
  // If the axis is CATEGORICAL (discrete groups, e.g. a horizontal bar chart whose Y axis lists 4.5, 7.0, 8.5, 10.5), set "type":"category" and list those group values in "ticks" in order from the axis origin outward. For a normal continuous axis use "linear" (or omit).
Series = {
  "id": string, "name": string, "color": hex,
  "marker": "circle"|"square"|"triangle"|"diamond"|"none",
  "markerFilled": boolean, "markerSize": number, "lineStyle": "solid"|"dashed"|"dotted"|"none",
  "lineWidth": number,
  "points": [ { "x","y","errorPlus"?,"errorMinus"?,"xErrorPlus"?,"xErrorMinus"?,"filled"? } ],
  "showInLegend": boolean,
  "kind"?: "line"|"bar",                 // "bar" for bar charts; "line" (or omit) for line/scatter
  "barOrientation"?: "horizontal"|"vertical"
}
  // BAR CHARTS: set "kind":"bar". Each colored bar in a group is ONE series (same color across groups).
  //   - horizontal bars (bars run left->right, groups stacked vertically): set "barOrientation":"horizontal", make the Y axis "type":"category". For each point: y = the category value (e.g. 8.5), x = the bar's length on the value axis (e.g. 80). Put the bar's error on "errorPlus"/"errorMinus" (value-axis error). If a group has no bar for this series, omit that point.
  //   - vertical bars: "barOrientation":"vertical", X axis "type":"category"; x = category value, y = bar height, error on errorPlus/errorMinus.
  //   - an outline-only (white/unfilled) bar => that point's "filled": false.
ReferenceLine = { "id","orientation":"horizontal"|"vertical","value","color","lineStyle","lineWidth","label"?,"showInLegend" }
TextSpec = { "id","content","x","y","fontSize","fontFamily","fontWeight":"normal"|"bold","fontStyle":"normal"|"italic","color","anchor":"start"|"middle"|"end","rotation" }
Legend = { "id","bounds":{"x","y","width","height"},"entries":[{"refId","label"}],"fontSize","fontFamily","showBorder","background" }
  // Each legend entry's refId MUST match an id of a Series or ReferenceLine in the same panel, so the renderer reuses its style.

Rules:
- Read tick labels literally from the axes to set min/max/ticks.
- Convert every data point from pixel position to DATA VALUE using the axis scales you read. Be as accurate as possible; include a point for every visible marker.
- Detect error bars: the vertical cap-to-cap extent around a marker => errorPlus/errorMinus (in data units). Horizontal caps => xErrorPlus/xErrorMinus.
- Markers drawn as outline-only (white/no fill) => set that point's "filled": false; otherwise omit "filled".
- Match colors by sampling the actual pixels (give real hex, not names).
- If a panel contains a smaller chart drawn inside it, put it in "insets".
- Give every element a short unique id.
- DO NOT DUPLICATE TEXT. Axis titles go ONLY in xAxis.label / yAxis.label. Tick numbers go ONLY in the "ticks" arrays. A panel/chart title goes ONLY in the panel's "title". "freeTexts" is exclusively for stray annotations that are none of the above (e.g. a note floating on the plot). Never repeat an axis title, tick number, or panel title inside "freeTexts" — the renderer already draws those, and repeating them makes the text render twice on top of itself. If there are no stray annotations, return "freeTexts": [].

Return the JSON now.`;
