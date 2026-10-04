import math

# Let us verify the W vertices:
# In standard bold geometric W:
# Outer vertices:
# Top 1: (x1_top, y_top)
# Bottom 1: (x_v1, y_bot)
# Middle Top: (x_v2, y_top)
# Bottom 2: (x_v3, y_bot)
# Top 2: (x4_top, y_top)

# Inner crotches:
# Crotch 1: between leg 1 and leg 2, at (x_c1, y_c1)
# Crotch mid: under Middle Top, between leg 2 and leg 3, at (x_cmid, y_cmid)
# Crotch 2: between leg 3 and leg 4, at (x_c2, y_c2)

# If:
# x1_top = 105.0, y_top = 330.0
# W_top = 86.0
# x1_top_in = 191.0
# x_v1 = 260.0, y_bot = 665.0
# x_cmid = 415.0, y_cmid = 530.0
# x_v2 = 415.0, y_top = 330.0
# x_v3 = 570.0, y_bot = 665.0
# x4_top = 725.0, y_top = 330.0
# x4_top_in = 639.0

# Then:
# Crotch 1 is inside the first V: around (260.0, 465.0)
# Crotch 2 is inside the second V: around (570.0, 465.0)
# Crotch mid is under the middle peak: around (415.0, 530.0)

print("Coordinates mapped logically.")
