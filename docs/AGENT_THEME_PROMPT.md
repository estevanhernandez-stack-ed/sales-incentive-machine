# SIM agent theme prompt

You are designing a theme for SIM, a playful, professional sales-contest dashboard for restaurant managers. The interface uses translucent cards over a blurred dark backdrop. Return only one valid JSON object. Do not use Markdown, a code fence, a preamble, or commentary.

## Required schema

Every color must be a six-digit hex value.

| Field | Role |
|---|---|
| `name` | Short human-readable theme name. |
| `bg` | Dark page backdrop. |
| `glass_on_mica` | Card and chrome surface base. |
| `glass` | Hover-source surface, slightly lighter than the card base. |
| `border` | Quiet boundary shared by panels and controls. |
| `text` | Primary text with at least 4.5:1 contrast against `glass_on_mica`. |
| `text_secondary` | Supporting copy, same hue family as primary text. |
| `text_dim` | Labels and inactive navigation. |
| `text_muted` | Lowest-emphasis readable text. |
| `accent` | The single brand/action color. |
| `positive` | Qualification, success, and completed states. |
| `negative` | Below-house and error states. |
| `bingo_marked` | Completed Bingo cells; distinct from the accent. |
| `pace_marker` | Wheel pointer and high-contrast focal marker. |
| `bar_bg` | Recessed rows and progress surfaces. |

Optional dials: `glass_alpha` (0–1), `border_alpha` (0–1), `border_tint` (hex or null), `inner_highlight` (`{"color":"#RRGGBB","alpha":0–1}` or null), `card_corner_radius` (0–40), `accent_bloom` (`{"blur":number,"alpha":0–1}` or null), `monospace_font` (string or null), `monospace_fallback` (string or null), and `opts_out_of_mica` (boolean).

## Design rules

1. Contrast first: `text` must be comfortably legible on `glass_on_mica`.
2. Cohesion: pull a small family of colors from the reference; do not mix unrelated accents.
3. One accent: action, active navigation, borders, and the first wheel color derive from `accent`.
4. Dark base: translucent layering needs a dark `bg` and card surface.
5. Typography is monochrome: the four text colors form one hue ramp with decreasing luminance.
6. `pace_marker` must stand out against the accent, positive, negative, and Bingo colors.

## Example

{"name":"Warm Signal","bg":"#171512","glass_on_mica":"#1d1916","glass":"#2b251f","border":"#6b4b2b","text":"#f7f0e6","text_secondary":"#d7c8b7","text_dim":"#b9ab9a","text_muted":"#948575","accent":"#f6ae55","positive":"#7bd6a0","negative":"#de9e91","bingo_marked":"#28784b","pace_marker":"#fff4dc","bar_bg":"#3b2b1d","glass_alpha":0.92,"border_alpha":0.72,"card_corner_radius":16,"opts_out_of_mica":false}

The user will paste your raw JSON into SIM's Theme panel. Return only the JSON object.
