import math

# Let Leg 1 be a stroke of width T slanted by angle theta.
# Let centerline of Leg 1 go from (x_c1_top, y_top) to (x_c1_bot, y_bot).
# Centerline of Leg 2 go from (x_c1_bot, y_bot) to (x_c2_top, y_top).
# Centerline of Leg 3 go from (x_c2_top, y_top) to (x_c3_bot, y_bot).
# Centerline of Leg 4 go from (x_c3_bot, y_bot) to (x_c4_top, y_top).

y_top = 330.0
y_bot = 665.0
H = y_bot - y_top # 335.0

theta = math.radians(24.5)
dx = H * math.tan(theta) # 152.6
T = 78.0 # stroke thickness perpendicular to stroke

# Stroke vector for Leg 1 (down-right):
# v1 = (sin(theta), cos(theta)) = (tan(theta)*cos(theta), cos(theta))
# Unit normal pointing to the right:
# n1 = (cos(theta), -sin(theta))
# So left edge of Leg 1: centerline - (T/2) * n1
# Right edge of Leg 1: centerline + (T/2) * n1

# For Leg 2 (up-right):
# Stroke vector v2 = (sin(theta), -cos(theta))
# Unit normal pointing to the right:
# n2 = (cos(theta), sin(theta))

# At the bottom V1:
# Left edge of Leg 1: x = x_center - (T/2)/cos(theta) + (y - y_top)*tan(theta)
# Right edge of Leg 2: x = x_center + (T/2)/cos(theta) + (y_bot - y)*tan(theta)
# The outer sharp apex at the bottom:
# Intersection of Leg 1 left edge and Leg 2 right edge!
# Since Leg 1 left edge has normal (-cos, sin), its equation is:
# (-cos(theta)) * x + sin(theta) * y = C_left
# Leg 2 right edge has normal (cos(theta), sin(theta)):
# cos(theta) * x + sin(theta) * y = C_right

print("Math formulated cleanly.")
