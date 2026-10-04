import math

# Correct geometric calculation of W and C monogram
y_top = 328.0
y_bot = 665.0
H = y_bot - y_top # 337.0

theta = math.radians(24.2)
tan_t = math.tan(theta) # 0.4494
cos_t = math.cos(theta)
sin_t = math.sin(theta)

T = 76.0
W_h = T / cos_t # 83.33

# Crotch vertical depth: distance from apex to inner crotch
dy_c = T / sin_t # 185.4? Wait, let's verify exact distance:
# The centerline of Leg 1 has equation L1. Centerline of Leg 2 has L2.
# Distance from centerline to boundary is T/2.
# Outer apex is where outer boundaries intersect: y_outer = y_centerline + (T/2)/sin_t
# Inner crotch is where inner boundaries intersect: y_inner = y_centerline - (T/2)/sin_t
# Total distance between outer apex and inner crotch is:
# dy_apex_to_crotch = (T/2)/sin_t + (T/2)/sin_t = T / sin_t = 185.4.
# BUT in W, the apex V1 is at y_bot = 665.
# If apex V1 is at y_bot, the inner crotch C1 is at y_bot - (T/sin_t)?
# Let us check: Leg 1 right boundary is shifted right by W_h.
# Leg 2 left boundary is shifted left by W_h.
# In a standard geometric font, the stroke doesn't have an infinitesimally sharp hairline.
# The crotch is optical.
# In the original image:
# Crotch 1 is at y ~ 460-480.
# Apex V1 is at y = 665.
# So depth is around 180-200px.
# Middle apex V2 is at y = 328.
# Inner crotch under V2:
# In the original image, is there a crotch under V2, or does V2 go straight down to V1 and V3?
# LOOK AT THE ORIGINAL IMAGE:
# Between Leg 2 and Leg 3:
# Leg 2 goes from V1(bottom) to V2(top).
# Leg 3 goes from V2(top) to V3(bottom).
# There is NO crotch under V2 because Leg 2 and Leg 3 are TWO LEGS meeting at V2!
# Leg 2 right boundary meets Leg 3 left boundary at V2!
# And Leg 2 left boundary goes from C1 to (V2 - flat) OR Leg 2 and 3 cross!

