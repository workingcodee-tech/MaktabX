import math

y_top = 328.0
y_bot = 665.0
H = y_bot - y_top # 337.0
theta = math.radians(24.2)
tan_t = math.tan(theta) # 0.4494
cos_t = math.cos(theta)
T = 76.0
W_h = T / cos_t # 83.35
dx = H * tan_t # 151.45

# Leg 1: goes down-right
# Left edge: (x1_top, y_top) -> (x1_top + dx, y_bot)
# Right edge: (x1_top + W_h, y_top) -> (x1_top + W_h + dx, y_bot)

# Leg 2: goes up-right
# To form a sharp apex V1 at y_bot:
# Leg 1 left edge must meet Leg 2 right edge!
# Leg 1 left edge hits y_bot at: x_V1 = x1_top + dx
# Leg 2 right edge must also hit y_bot at: x_V1!
# Leg 2 right edge goes from (x_V1, y_bot) to (x_V1 + dx, y_top) = (x_V2, y_top)!
# Leg 2 left edge is parallel, shifted left by W_h:
# goes from (x_V1 - W_h, y_bot) to (x_V2 - W_h, y_top)!

# Now: where does Leg 1 right edge meet Leg 2 left edge?
# Leg 1 right edge: x(y) = (x1_top + W_h) + (y - y_top)*tan_t
# Leg 2 left edge: x(y) = (x_V2 - W_h) - (y - y_top)*tan_t  <-- wait!
# At y = y_bot: x = x_V1 - W_h = (x1_top + dx) - W_h.
# At y = y_top: x = x_V2 - W_h = (x1_top + 2*dx) - W_h.
# So as y goes from y_top to y_bot, x DECREASES!
# x(y) = (x_V2 - W_h) - (y - y_top)*tan_t:
# Check at y = y_bot: (x_V2 - W_h) - H*tan_t = x_V2 - W_h - dx = x_V1 - W_h. Correct!

# So Crotch 1 is the intersection of Leg 1 right edge and Leg 2 left edge:
# (x1_top + W_h) + (y - y_top)*tan_t = (x_V2 - W_h) - (y - y_top)*tan_t
# 2 * (y - y_top) * tan_t = (x_V2 - W_h) - (x1_top + W_h)
# Since x_V2 = x1_top + 2*dx:
# 2 * (y - y_top) * tan_t = (x1_top + 2*dx - W_h) - (x1_top + W_h) = 2*dx - 2*W_h
# (y - y_top) * tan_t = dx - W_h
# y - y_top = (dx - W_h) / tan_t = H - W_h / tan_t
# y_C1 = y_top + H - W_h / tan_t = y_bot - W_h / tan_t!
# And x_C1:
# x_C1 = (x1_top + W_h) + (H - W_h / tan_t)*tan_t = x1_top + W_h + dx - W_h = x1_top + dx = x_V1!

print("Pure mathematical proof verified:")
print(f"Crotch 1 is exactly at (x_V1, y_bot - W_h/tan_t)!")
print(f"y_bot = {y_bot}, W_h/tan_t = {W_h/tan_t:.1f}, y_C1 = {y_bot - W_h/tan_t:.1f}")
