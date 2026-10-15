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
  "freeTexts": [ TextSpec ],
  "freeLines": [ FreeLine ]                                          // straight rule lines outside any plot (e.g. underlines of a stats table below the chart), [] if none
}
FreeLine = { "id", "x1", "y1", "x2", "y2", "color": hex, "lineWidth": number }   // pixel coordinates
Panel = {
  "id": string,
  "title": TextSpec | null,
  "plotArea": {"x","y","width","height"},                           // inner data-drawing rectangle (inside the axes)
  "xAxis": Axis, "yAxis": Axis,
  "series": [ Series ],
  "referenceLines": [ ReferenceLine ],
  "legends": [ Legend ],
  "regions": [ Region ],                                            // background bands (see below), [] if none
  "insets": [ Panel ],                                              // nested inset charts, [] if none
  "showBorder": boolean
}
Axis = { "label": string, "min": number, "max": number, "ticks": [number], "tickFormat": "percent" | "number", "type"?: "linear"|"category", "axisStyle"?: "plain"|"arrow", "color"?: hex, "showTickLabels"?: boolean, "tickDecimals"?: number, "gridLines"?: [number], "gridColor"?: hex, "fontSize": number, "labelFontSize": number, "labelBold": boolean, "labelOffset"?: number }
  // "fontSize" = font size in pixels (same coordinate space as plotArea) of the tick numbers; "labelFontSize" = of the axis title; "labelBold" = whether the axis title is bold. Measure them from the image — do not assume 12.
  // "labelOffset" = perpendicular distance in pixels from the axis line to the CENTER of the axis title text (X axis: downward from the bottom axis line; Y axis: leftward from the left axis line). Measure it; omit only if the axis has no title.
  // "ticks" = ONLY the values that have a printed number on the axis. If labels show a fixed number of decimals (e.g. "4.0", "5.9"), set "tickDecimals" (here 1).
  // GRID: if the plot has grid lines, list the DATA values where they are drawn in "gridLines" of the axis they are measured on (X-axis gridLines = vertical lines, Y-axis gridLines = horizontal lines) and their color in "gridColor". Grid lines are independent of ticks: e.g. a Y axis labelled only "0" and "180" with 9 horizontal grid lines => ticks [0,180], gridLines [20,40,...,160]. Count the grid lines carefully.
  // min/max must be the values at the plot area's edges (where the frame / axis lines are).
  // For an axis showing "0%","10%"... use tickFormat "percent" and put the NUMBER as shown (e.g. 10 for "10%") — do NOT divide by 100.
  // If the axis is CATEGORICAL (discrete groups, e.g. a horizontal bar chart whose Y axis lists 4.5, 7.0, 8.5, 10.5), set "type":"category" and list those group values in "ticks" in order from the axis origin outward. For a normal continuous axis use "linear" (or omit).
  // If the axis is drawn as an ARROW (a conceptual diagram with colored arrow axes and NO numbers), set "axisStyle":"arrow", "color" to the arrow color, "ticks":[], and "showTickLabels":false. Still give sensible min/max so data scales.
Region = { "id": string, "xStart": number, "xEnd": number, "fill": hex, "fillOpacity"?: number, "label"?: string, "labelColor"?: hex, "labelPosition"?: "top"|"bottom" }
  // A vertical background band spanning the full plot height between xStart..xEnd on the X axis. Use for chromatogram phase bands (Equilibration, Sample Application, Elution, ...) and alternating gray shaded zones. Label sits near the bottom by default.
Series = {
  "id": string, "name": string, "color": hex,
  "marker": "circle"|"square"|"triangle"|"diamond"|"none",
  "markerFilled": boolean, "markerSize": number, "lineStyle": "solid"|"dashed"|"dotted"|"none",
  "lineWidth": number,
  "points": [ { "x","y","errorPlus"?,"errorMinus"?,"xErrorPlus"?,"xErrorMinus"?,"filled"? } ],
  "showInLegend": boolean,
  "kind"?: "line"|"bar"|"stem",          // "bar" for bar charts; "stem" for dense histograms (see below); "line" (or omit) for line/scatter
  "barOrientation"?: "horizontal"|"vertical",
  "areaFill"?: { "color": hex, "opacity": number },  // fill under the line down to y=0 (e.g. shaded elution peak)
  "smooth"?: boolean                                 // true => render as a smooth curve (for continuous/curved traces)
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
- CHROMATOGRAM (continuous traces vs volume/time, e.g. UV & Conductivity): each trace is one "line" series with many sampled points following the curve (sample densely enough to capture every rise/fall/peak). Put each labeled phase band (Equilibration, Sample Application, High Salt Column Wash, pH 5 Column Wash, Elution, ...) and any alternating gray shaded zone into "regions". If a peak is shaded/filled underneath, give that trace (or a dedicated series covering the peak) an "areaFill". A numeric label printed at a peak (e.g. "13054.57") is a freeText at that pixel position.
- DENSE HISTOGRAM (dozens to hundreds of thin vertical bars/lines on a CONTINUOUS numeric X axis, e.g. particle-size or cell-count distributions): do NOT use "bar". Make ONE series per bar color with "kind":"stem", "color" = the bars' exact dominant color (sample a solid bar pixel, not a light anti-aliased edge), "marker":"none", "lineStyle":"solid", "lineWidth":1, and give only a COARSE outline of 30-60 points (x = position, y = bar height) — the application re-measures every bar from the image pixels, so precision here does not matter, but "plotArea", the axis min/max and the color MUST be accurate. A fitted curve drawn over the histogram (e.g. a Gaussian fit, often with a colored fill and an outline) is a separate "line" series with "smooth":true, "areaFill" for the fill, "color" = its outline color, sampled densely (50+ points). List series back-to-front: the histogram first, the fit curve after it.
- CONCEPTUAL / DECONVOLUTION plots (smooth envelope curve + component peaks shown as dotted curves, arrow axes, no numbers): the envelope is a "line" series with "smooth":true and solid line. Each component curve is a "line" series drawn as DOTS: marker:"circle" (small), lineStyle:"none". Set both axes "axisStyle":"arrow", their arrow "color", "ticks":[], "showTickLabels":false. Keep axis "label" only if the image shows one (e.g. Y="Concentration").
- DENSITY IS CRITICAL for curves/dots. COUNT the dots you actually see in each dotted curve and output ONE point per visible dot — typically 30-60 points per curve. Do NOT summarize a curve with 10-15 points; that makes it look sparse and jagged. Space the points evenly along the whole curve, all the way up each peak and back down, so the reconstructed dots overlay the originals. For any smooth continuous line (envelope, chromatogram trace), sample at least 50 points following every bend, and set "smooth":true so it renders as a fluid curve.
- Give every element a short unique id.
- DO NOT DUPLICATE TEXT. Axis titles go ONLY in xAxis.label / yAxis.label. Tick numbers go ONLY in the "ticks" arrays. A panel/chart title goes ONLY in the panel's "title". "freeTexts" is exclusively for stray annotations that are none of the above (e.g. a note floating on the plot, a timestamp or instrument/file name in the header, each line of a statistics table printed below the chart). Never repeat an axis title, tick number, or panel title inside "freeTexts" — the renderer already draws those, and repeating them makes the text render twice on top of itself. If there are no stray annotations, return "freeTexts": [].

Return the JSON now.`;
