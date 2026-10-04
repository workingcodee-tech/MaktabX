import math

# Generate the geometrically flawless Working Code Monogram SVG matching user image

# Background badge: White circle, gentle subtle depth
# Letter "W": Deep Graphite Slate #18202C (or #161F2E)
# Letter "C" & lower accent of Leg 4: Electric Blue #0066FF

# Parameters
y_top = 330.0
y_bot = 665.0
H = y_bot - y_top # 335.0

theta = math.radians(24.5)
tan_t = math.tan(theta)
sin_t = math.sin(theta)
cos_t = math.cos(theta)

# Stroke thickness
T = 78.0
W_h = T / cos_t # horizontal width ~ 85.7

# Horizontal alignment:
# Total visual width ~ 810px (from x ~ 95 to x ~ 905)
# Center ~ 500
x_v1 = 250.0
x_v2 = x_v1 + H * tan_t # ~ 402.6
x_v3 = x_v2 + H * tan_t # ~ 555.3
x_v4_top = x_v3 + H * tan_t # ~ 707.9
x_v1_top = x_v1 - H * tan_t # ~ 97.4

# Top and bottom points
P_leg1_top_left = (x_v1_top, y_top)
P_leg1_top_right = (x_v1_top + W_h, y_top)

V1_bottom = (x_v1, y_bot)

# Crotch 1 (between Leg 1 and Leg 2)
# y_c1 = y_bot - (W_h / 2) / tan_t * 2 ?
# Leg 1 inner edge: x = x_v1_top + W_h + (y - y_top)*tan_t
# Leg 2 inner edge: x = x_v1 + (y_bot - y)*tan_t ...
# Since V1 is at (x_v1, y_bot), Crotch 1 is at (x_v1, y_bot - W_h / tan_t)
y_c1 = y_bot - W_h / tan_t
Crotch1 = (x_v1, y_c1)

V2_top = (x_v2, y_top)

# Crotch mid (under V2):
y_cmid = y_top + W_h / tan_t
Crotch_mid = (x_v2, y_cmid)

V3_bottom = (x_v3, y_bot)

# Crotch 2 (between Leg 3 and Leg 4)
Crotch2 = (x_v3, y_c1)

P_leg4_top_right = (x_v4_top, y_top)
P_leg4_top_left = (x_v4_top - W_h, y_top)

print(f"P_leg1_top_left: {P_leg1_top_left}")
print(f"V1: {V1_bottom}, Crotch1: {Crotch1}")
print(f"V2: {V2_top}, Crotch_mid: {Crotch_mid}")
print(f"V3: {V3_bottom}, Crotch2: {Crotch2}")
print(f"P_leg4_top_right: {P_leg4_top_right}")
