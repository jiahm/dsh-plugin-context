/** All rules are scoped to the plugin; colors use the host's semantic tokens. */
export const css = `
[data-context-visualizer] { color: var(--dsw-alias-label-primary); padding: 16px; height: 100%; overflow: auto; font: 13px/1.6 var(--dsw-font-family); box-sizing: border-box; }
[data-context-visualizer] * { box-sizing: border-box; }
[data-context-visualizer] h2 { margin: 0; font-size: 17px; font-weight: 600; }
[data-context-visualizer] h3 { margin: 0 0 12px; font-size: 14px; font-weight: 500; }
[data-context-visualizer] .cv-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
[data-context-visualizer] .cv-card { border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
[data-context-visualizer] .cv-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; }
[data-context-visualizer] .cv-metric { display: flex; flex-direction: column; gap: 4px; }
[data-context-visualizer] .cv-metric strong { font-size: 20px; font-variant-numeric: tabular-nums; font-weight: 600; }
[data-context-visualizer] .cv-muted { color: var(--dsw-alias-label-secondary); font-size: 12px; }
[data-context-visualizer] button, [data-context-visualizer] input { font: inherit; color: inherit; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); padding: 6px 10px; border-radius: 8px; }
[data-context-visualizer] button { cursor: pointer; }
[data-context-visualizer] button:hover { background: var(--dsw-alias-interactive-bg-hover); }
[data-context-visualizer] button[aria-pressed="true"] { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-interactive-bg-hover); }
[data-context-visualizer] button:focus-visible, [data-context-visualizer] input:focus-visible, [data-context-visualizer] summary:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
[data-context-visualizer] .cv-filters { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
[data-context-visualizer] input { width: 100%; }
[data-context-visualizer] .cv-composition { display: grid; gap: 8px; }
[data-context-visualizer] .cv-category { display: grid; grid-template-columns: 110px 1fr 64px; align-items: center; gap: 8px; }
[data-context-visualizer] .cv-track { height: 7px; border-radius: 5px; overflow: hidden; background: var(--dsw-alias-bg-layer-2); }
[data-context-visualizer] .cv-fill { height: 100%; min-width: 1px; background: var(--dsw-alias-brand-primary); }
[data-context-visualizer] .cv-trend { display: flex; gap: 4px; height: 150px; align-items: end; overflow-x: auto; padding: 8px 0; }
[data-context-visualizer] .cv-trend button { min-width: 28px; padding: 0; height: 100%; background: transparent; border: 0; display: flex; flex-direction: column; align-items: stretch; justify-content: end; gap: 4px; }
[data-context-visualizer] .cv-bar { background: var(--dsw-alias-brand-primary); border-radius: 4px 4px 0 0; min-height: 3px; opacity: .6; }
[data-context-visualizer] .cv-trend button[aria-pressed="true"] .cv-bar { opacity: 1; }
[data-context-visualizer] details { border-top: 1px solid var(--dsw-alias-border-l2); padding: 8px 0; }
[data-context-visualizer] summary { cursor: pointer; overflow-wrap: anywhere; }
[data-context-visualizer] pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 280px; overflow: auto; font: 12px/1.6 var(--ds-font-family-code); }
[data-context-visualizer] .cv-event { display: flex; flex-wrap: wrap; gap: 8px; padding: 6px 0; border-top: 1px solid var(--dsw-alias-border-l2); }
`
