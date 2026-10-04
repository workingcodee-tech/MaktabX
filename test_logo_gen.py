import math

# Dimensions
# Canvas: 1000 x 1000, Center: (500, 500)
# Outer white circle: cx=500, cy=500, r=460

DARK = "#18202C"
BLUE = "#0066FF"

y_top = 330.0
y_bot = 665.0
H = y_bot - y_top # 335.0

# Slant angle of W
theta = math.radians(24.5)
dx = H * math.tan(theta) # 152.6
# Horizontal width of leg
W_h = 92.0

# Vertices of W along baseline (y_bot) and topline (y_top)
# Let whole WC be centered horizontally:
# W starts at x_w_start ~ 100
# C ends at ~ 900
# Center ~ 500

x1_top = 105.0
x1_bot = x1_top + dx # V1 bottom point: (x1_bot, y_bot)

# Leg 1: from (x1_top, y_top) to (x1_bot, y_bot)
# Width is W_h to the right:
# Top right of leg 1: (x1_top + W_h, y_top)
# Inner crotch 1: where right edge of Leg 1 meets left edge of Leg 2.
# Leg 2 goes from V1(x1_bot, y_bot) to V2(x2_top, y_top).
# By symmetry, x2_top = x1_bot + dx.
x2_top = x1_bot + dx
# Left edge of Leg 2: from (x1_bot, y_bot) to (x2_top - W_h, y_top)... wait!
# V1 is an apex (point)!
# Left edge of Leg 1: x = x1_top + (y - y_top)*tan(theta)
# Right edge of Leg 2: x = x1_bot + (y_bot - y)*tan(theta)... wait!
# Leg 1 left edge hits y_bot at x1_bot.
# Leg 2 right edge also hits y_bot at x1_bot!
# So at y_bot, Leg 1 and Leg 2 meet at the single sharp point V1 = (x1_bot, y_bot)!

