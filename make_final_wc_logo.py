import math

# Overall parameters
width = 1000
height = 1000

# Colors from official user image:
# Deep Charcoal Slate: #1A2232
# Vibrant Electric Blue: #0066FF
# Clean white container badge with subtle shadow

y_top = 328.0
y_bot = 665.0
H = y_bot - y_top # 337.0

# In the user image, let's look at the points:
# Leg 1:
# Top left: (108, 328)
# Top right: (188, 328)
# Bottom V1 apex: (254, 665)
# Crotch 1: (254, 485)

# Leg 2:
# Top V2 apex: (408, 328)
# Crotch under V2: (408, 508)

# Leg 3:
# Bottom V3 apex: (562, 665)
# Crotch 2: (562, 485)

# Leg 4:
# Top right: (716, 328)
# Top left: (636, 328)

# Slit:
# Slices through Leg 4 at around y = 415 to y = 475
# Slit gap = 16px
# Slit slope matches Leg 3 (dx/dy = (562-408)/(665-328) = 154/337 = 0.457)

p1_tl = (108.0, 328.0)
p1_tr = (188.0, 328.0)
V1    = (254.0, 665.0)
C1    = (254.0, 485.0)
V2    = (408.0, 328.0)
C_mid = (408.0, 508.0)
V3    = (562.0, 665.0)
C2    = (562.0, 485.0)
p4_tr = (716.0, 328.0)
p4_tl = (636.0, 328.0)

# Slit coordinates on Leg 4:
# Leg 4 left edge: goes from C2(562, 485) to p4_tl(636, 328)
# dx/dy = (636-562)/(328-485) = 74 / (-157) = -0.471
# Leg 4 right edge: goes from V3(562, 665) to p4_tr(716, 328)
# dx/dy = (716-562)/(328-665) = 154 / (-337) = -0.457

# Slit center line passes through (636, 420) with slope dx/dy = 0.457
# Top slit edge:
s_tl = (608.0, 388.0)
s_tr = (655.0, 462.0)

# Bottom slit edge:
s_bl = (601.0, 403.0)
s_br = (648.0, 477.0)

# "C" ring parameters:
# Center: cx = 738, cy = 496.5
# Outer radius R_out = 168.5, Inner radius R_in = 92.5
# Gap angle: 33 degrees
cx = 738.0
cy = 496.5
R_out = 168.5
R_in = 92.5
ang = math.radians(33.0)

c_top_out = (cx + R_out * math.cos(ang), cy - R_out * math.sin(ang))
c_top_in  = (cx + R_in  * math.cos(ang), cy - R_in  * math.sin(ang))
c_bot_out = (cx + R_out * math.cos(ang), cy + R_out * math.sin(ang))
c_bot_in  = (cx + R_in  * math.cos(ang), cy + R_in  * math.sin(ang))

svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="100%" height="100%">
  <defs>
    <!-- Soft circular badge background -->
    <radialGradient id="wcBadgeGrad" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="85%" stop-color="#ffffff"/>
      <stop offset="96%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </radialGradient>
    <filter id="wcShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.08"/>
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.04"/>
    </filter>
  </defs>

  <!-- Circular White Avatar Container -->
  <circle cx="500" cy="500" r="462" fill="url(#wcBadgeGrad)" stroke="#f1f5f9" stroke-width="2.5" filter="url(#wcShadow)"/>

  <!-- WC Vector Monogram -->
  <g id="wc-logo-mark">
    <!-- W Dark Slate Charcoal Body (#1A2232) -->
    <!-- Leg 1, Leg 2, Leg 3 -->
    <path d="
      M {p1_tl[0]:.1f} {p1_tl[1]:.1f}
      L {p1_tr[0]:.1f} {p1_tr[1]:.1f}
      L {C1[0]:.1f} {C1[1]:.1f}
      L {V2[0]:.1f} {V2[1]:.1f}
      L {C2[0]:.1f} {C2[1]:.1f}
      L {V3[0]:.1f} {V3[1]:.1f}
      L {C_mid[0]:.1f} {C_mid[1]:.1f}
      L {V1[0]:.1f} {V1[1]:.1f}
      Z
    " fill="#1A2232" />

    <!-- Leg 4 Top Floating Piece (#1A2232) -->
    <path d="
      M {p4_tl[0]:.1f} {p4_tl[1]:.1f}
      L {p4_tr[0]:.1f} {p4_tr[1]:.1f}
      L {s_tr[0]:.1f} {s_tr[1]:.1f}
      L {s_tl[0]:.1f} {s_tl[1]:.1f}
      Z
    " fill="#1A2232" />

    <!-- Vibrant Electric Blue (#0066FF): Leg 4 Lower Piece + C Ring -->
    <path d="
      M {s_bl[0]:.1f} {s_bl[1]:.1f}
      L {s_br[0]:.1f} {s_br[1]:.1f}
      A {R_out:.1f} {R_out:.1f} 0 0 1 {c_top_out[0]:.1f} {c_top_out[1]:.1f}
      L {c_top_in[0]:.1f} {c_top_in[1]:.1f}
      A {R_in:.1f} {R_in:.1f} 0 1 0 {c_bot_in[0]:.1f} {c_bot_in[1]:.1f}
      L {c_bot_out[0]:.1f} {c_bot_out[1]:.1f}
      A {R_out:.1f} {R_out:.1f} 0 0 1 {cx:.1f} {cy + R_out:.1f}
      L {V3[0]:.1f} {V3[1]:.1f}
      L {C2[0]:.1f} {C2[1]:.1f}
      Z
    " fill="#0066FF" />
  </g>
</svg>'''

with open("public/working-code-logo.svg", "w") as f:
    f.write(svg_content)

with open("dist/working-code-logo.svg", "w") as f:
    f.write(svg_content)

print("Final Working Code Monogram written successfully!")
