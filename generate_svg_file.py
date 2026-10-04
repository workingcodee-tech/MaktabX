import math

y_top = 328.0
y_bot = 665.0
H = y_bot - y_top # 337.0

theta = math.radians(24.2)
tan_t = math.tan(theta)
sin_t = math.sin(theta)
cos_t = math.cos(theta)

T = 76.0
W_h = T / cos_t # ~ 83.3

# Base points
x_v1 = 252.0
x_v2 = x_v1 + H * tan_t # 403.4
x_v3 = x_v2 + H * tan_t # 554.9
x_v4_top = x_v3 + H * tan_t # 706.3
x_v1_top = x_v1 - H * tan_t # 100.6

# 1. Top left
p_l1_top_left = (x_v1_top, y_top)
p_l1_top_right = (x_v1_top + W_h, y_top)

# V1
V1 = (x_v1, y_bot)

# Crotch 1
y_c1 = y_bot - W_h / tan_t
C1 = (x_v1, y_c1)

# V2
V2 = (x_v2, y_top)

# Crotch under V2
y_cmid = y_top + W_h / tan_t
C_mid = (x_v2, y_cmid)

# V3
V3 = (x_v3, y_bot)

# Crotch 2
C2 = (x_v3, y_c1)

# Leg 4 top
p_l4_top_right = (x_v4_top, y_top)
p_l4_top_left = (x_v4_top - W_h, y_top)

# Slit / Gap across Leg 4
# Slit runs parallel to Leg 3: direction is (tan_t, 1) or (-tan_t, 1)
# Leg 3 goes from (x_v2, y_top) to (x_v3, y_bot): dx/dy = tan_t > 0
# Slit slope: dx/dy = tan_t (same as Leg 3)
# Slit center y:
y_slit = 425.0
slit_gap = 14.0 # perpendicular width of gap
dy_slit_gap = (slit_gap / 2.0) / cos_t # vertical half-thickness

# Top boundary of slit: line passing through (x_s, y_slit - dy_slit_gap) with slope tan_t
# Leg 4 left edge: passes through C2(x_v3, y_c1) to p_l4_top_left(x_v4_top - W_h, y_top)
# Line: x - (x_v4_top - W_h) = -(y - y_top)*tan_t  => x(y) = (x_v4_top - W_h) - (y - y_top)*tan_t
# Wait! Leg 4 goes up-right: from V3 to top!
# At V3(554.9, 665), x is 554.9. At top(706.3, 328), x is 706.3!
# As y decreases (goes up), x INCREASES!
# dx/dy = -tan_t ! (since dy is negative as we go up, dx is positive).
# So for Leg 4 left edge: x(y) = x_v3 - (y - y_c1)*tan_t
# And for Leg 4 right edge: x(y) = x_v3 - (y - y_bot)*tan_t

# Slit line: runs like Leg 3 (as y decreases, x DECREASES: dx/dy = tan_t)
# Let slit line equation: x(y) = x_slit_center + (y - y_slit)*tan_t

x_slit_center = 635.0

# Slit upper boundary: x(y) = x_slit_center + (y - (y_slit - dy_slit_gap))*tan_t
# Intersection of Slit Upper Boundary with Leg 4 Left Edge:
# x_slit_center + (y - y_slit + dy_slit_gap)*tan_t = x_v3 - (y - y_c1)*tan_t
# 2*y*tan_t = x_v3 - x_slit_center + (y_c1 + y_slit - dy_slit_gap)*tan_t
y_slit_top_left = (x_v3 - x_slit_center) / (2*tan_t) + (y_c1 + y_slit - dy_slit_gap) / 2
x_slit_top_left = x_v3 - (y_slit_top_left - y_c1)*tan_t

# Intersection with Leg 4 Right Edge:
# x(y) = x_v3 - (y - y_bot)*tan_t
y_slit_top_right = (x_v3 - x_slit_center) / (2*tan_t) + (y_bot + y_slit - dy_slit_gap) / 2
x_slit_top_right = x_v3 - (y_slit_top_right - y_bot)*tan_t

# Slit lower boundary: (y - (y_slit + dy_slit_gap))
y_slit_bot_left = (x_v3 - x_slit_center) / (2*tan_t) + (y_c1 + y_slit + dy_slit_gap) / 2
x_slit_bot_left = x_v3 - (y_slit_bot_left - y_c1)*tan_t

y_slit_bot_right = (x_v3 - x_slit_center) / (2*tan_t) + (y_bot + y_slit + dy_slit_gap) / 2
x_slit_bot_right = x_v3 - (y_slit_bot_right - y_bot)*tan_t

# "C" geometry
cx = 736.0
cy = 496.5
R_out = 168.0
R_in = 92.0
ang_gap = math.radians(34.0)

# C terminals
# Top terminal:
x_c_top_out = cx + R_out * math.cos(ang_gap)
y_c_top_out = cy - R_out * math.sin(ang_gap)
x_c_top_in  = cx + R_in * math.cos(ang_gap)
y_c_top_in  = cy - R_in * math.sin(ang_gap)

# Bottom terminal:
x_c_bot_out = cx + R_out * math.cos(ang_gap)
y_c_bot_out = cy + R_out * math.sin(ang_gap)
x_c_bot_in  = cx + R_in * math.cos(ang_gap)
y_c_bot_in  = cy + R_in * math.sin(ang_gap)

print(f"Slit top: ({x_slit_top_left:.1f}, {y_slit_top_left:.1f}) to ({x_slit_top_right:.1f}, {y_slit_top_right:.1f})")
print(f"Slit bot: ({x_slit_bot_left:.1f}, {y_slit_bot_left:.1f}) to ({x_slit_bot_right:.1f}, {y_slit_bot_right:.1f})")

