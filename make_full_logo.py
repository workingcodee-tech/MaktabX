import math

y_top = 328.0
y_bot = 665.0
H = y_bot - y_top # 337.0

theta = math.radians(24.2)
tan_t = math.tan(theta)
sin_t = math.sin(theta)
cos_t = math.cos(theta)

T = 76.0
W_h = T / cos_t # 83.33

x_v1 = 252.0
x_v2 = x_v1 + H * tan_t # 403.4
x_v3 = x_v2 + H * tan_t # 554.9
x_v4_top = x_v3 + H * tan_t # 706.3
x_v1_top = x_v1 - H * tan_t # 100.6

# Crotch heights
y_c1 = y_bot - W_h / tan_t # 479.6
y_cmid = y_top + W_h / tan_t # 513.4

# Slit on Leg 4
# We position slit so that the top dark part of Leg 4 is clearly visible
# and the blue C meets the blue lower part
y_slit = 425.0
slit_gap = 16.0
dy_slit_gap = (slit_gap / 2.0) / cos_t

x_slit_center = 636.0

# Slit lines: dx/dy = tan_t
# Leg 4 left edge: dx/dy = -tan_t, passes through (x_v3, y_c1)
# Leg 4 right edge: dx/dy = -tan_t, passes through (x_v3, y_bot)

# Top boundary of slit
y_s_tl = (x_v3 - x_slit_center) / (2*tan_t) + (y_c1 + y_slit - dy_slit_gap) / 2
x_s_tl = x_v3 - (y_s_tl - y_c1)*tan_t

y_s_tr = (x_v3 - x_slit_center) / (2*tan_t) + (y_bot + y_slit - dy_slit_gap) / 2
x_s_tr = x_v3 - (y_s_tr - y_bot)*tan_t

# Bot boundary of slit
y_s_bl = (x_v3 - x_slit_center) / (2*tan_t) + (y_c1 + y_slit + dy_slit_gap) / 2
x_s_bl = x_v3 - (y_s_bl - y_c1)*tan_t

y_s_br = (x_v3 - x_slit_center) / (2*tan_t) + (y_bot + y_slit + dy_slit_gap) / 2
x_s_br = x_v3 - (y_s_br - y_bot)*tan_t

# C circle
cx = 736.0
cy = 496.5
R_out = 168.5
R_in = 92.5
ang_gap = math.radians(33.0)

x_c_top_out = cx + R_out * math.cos(ang_gap)
y_c_top_out = cy - R_out * math.sin(ang_gap)
x_c_top_in  = cx + R_in * math.cos(ang_gap)
y_c_top_in  = cy - R_in * math.sin(ang_gap)

x_c_bot_out = cx + R_out * math.cos(ang_gap)
y_c_bot_out = cy + R_out * math.sin(ang_gap)
x_c_bot_in  = cx + R_in * math.cos(ang_gap)
y_c_bot_in  = cy + R_in * math.sin(ang_gap)

# Build SVG
svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="100%" height="100%">
  <defs>
    <!-- Soft circular badge background with subtle shading -->
    <radialGradient id="wcBadge" cx="50%" cy="46%" r="52%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="85%" stop-color="#ffffff"/>
      <stop offset="96%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#edf2f7"/>
    </radialGradient>
    <filter id="wcDepth" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.07"/>
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.04"/>
    </filter>
  </defs>

  <!-- Circular White Avatar Container -->
  <circle cx="500" cy="500" r="462" fill="url(#wcBadge)" stroke="#f1f5f9" stroke-width="2.5" filter="url(#wcDepth)"/>

  <!-- Monogram Elements -->
  <g id="wc-monogram">
    <!-- W Dark Charcoal Shapes (#18202C) -->
    <!-- Part 1: Main W body (Leg 1, Leg 2, Leg 3) -->
    <path d="M {x_v1_top:.2f} {y_top:.2f} L {x_v1_top + W_h:.2f} {y_top:.2f} L {x_v1:.2f} {y_c1:.2f} L {x_v2:.2f} {y_top:.2f} L {x_v3:.2f} {y_c1:.2f} L {x_v3:.2f} {y_bot:.2f} L {x_v2:.2f} {y_cmid:.2f} L {x_v1:.2f} {y_bot:.2f} Z" fill="#18202C" />

    <!-- Part 2: Leg 4 Top Floating Piece -->
    <path d="M {x_v4_top - W_h:.2f} {y_top:.2f} L {x_v4_top:.2f} {y_top:.2f} L {x_s_tr:.2f} {y_s_tr:.2f} L {x_s_tl:.2f} {y_s_tl:.2f} Z" fill="#18202C" />

    <!-- Electric Blue WC Shape (#0066FF): Leg 4 Lower Accent + C Ring -->
    <!-- 
      This is a single unified vector path:
      Starts at Leg 4 lower slit boundary ->
      moves down along Leg 4 left edge to Crotch 2 ->
      down to V3 bottom apex ->
      sweeps right along bottom of C outer arc ->
      up around C to top terminal ->
      radial cut to inner top terminal ->
      arc around inner C ->
      radial cut to bottom terminal ->
      outer arc back around or meeting slit
    -->
    <path d="
      M {x_s_bl:.2f} {y_s_bl:.2f}
      L {x_s_br:.2f} {y_s_br:.2f}
      L {x_v3 - (cy - y_bot)*tan_t:.2f} {cy:.2f}
      A {R_out:.2f} {R_out:.2f} 0 0 1 {x_c_top_out:.2f} {y_c_top_out:.2f}
      L {x_c_top_in:.2f} {y_c_top_in:.2f}
      A {R_in:.2f} {R_in:.2f} 0 1 0 {x_c_bot_in:.2f} {y_c_bot_in:.2f}
      L {x_c_bot_out:.2f} {y_c_bot_out:.2f}
      A {R_out:.2f} {R_out:.2f} 0 0 1 {cx:.2f} {cy + R_out:.2f}
      L {x_v3:.2f} {y_bot:.2f}
      L {x_v3:.2f} {y_c1:.2f}
      Z
    " fill="#0066FF" />
  </g>
</svg>'''

with open("public/working-code-logo.svg", "w") as f:
    f.write(svg_content)

with open("dist/working-code-logo.svg", "w") as f:
    f.write(svg_content)

print("SVG successfully generated.")
