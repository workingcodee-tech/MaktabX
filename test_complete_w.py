import math

# Let us verify the polygon of the full W:
# Vertices:
# 1. Top left: (101.45, 330.0)
# 2. Top left inner: (184.75, 330.0)
# 3. Crotch 1: (252.0, 479.6)
# 4. Top middle apex V2: (402.55, 330.0)
# Wait, does the inner contour go to V2?
# If inner contour of Leg 1 goes to Crotch 1,
# then Leg 2 right edge goes from V1(252, 665) to V2(402.55, 330).
# What about the left edge of Leg 2?
# Left edge of Leg 2 goes from Crotch 1(252.0, 479.6) to ... WHERE?
# If Leg 2 has width W_h = 83.3, and its right edge ends at (402.55, 330.0),
# then its left edge must end at (402.55 - 83.3, 330.0) = (319.25, 330.0)!
# And Leg 3 right edge: its left edge is at (402.55, 330.0),
# so its right edge must end at (402.55 + 83.3, 330.0) = (485.85, 330.0)!
# That would mean V2 has a flat top from 319.25 to 485.85 of width 166.6px!
# BUT in the user image, V2 is a SHARP APEX!
# Why is V2 a sharp apex?
# Because in a typeface like this, Leg 2 and Leg 3 OVERLAP or METER at the apex!
# Let us check how Leg 2 and Leg 3 meet at a sharp apex:
# Leg 2 centerline: goes from V1 to V2.
# Leg 3 centerline: goes from V2 to V3.
# The outer edges meet at V2_top = (402.55, 330.0).
# The inner edges meet at C_mid = (402.55, 330.0 + dy_inner)!
# YES! That is the classic inner apex (crotch) under V2!

