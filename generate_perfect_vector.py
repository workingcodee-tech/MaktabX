import math

def solve():
    # Desired visual bounds:
    # Top of W: y = 330.0
    # Bottom of W: y = 665.0
    # Height H = 335.0
    y_top = 330.0
    y_bot = 665.0
    H = y_bot - y_top

    # Angle from user image: 24.5 degrees
    theta = math.radians(24.5)
    sin_t = math.sin(theta)
    cos_t = math.cos(theta)
    tan_t = math.tan(theta)

    # Thickness of strokes
    # In user image, stroke width is around 76px
    T = 76.0

    # Vertical offset from apex to centerline intersection:
    # apex_y = centerline_y - (T/2) / sin_t for top apex
    # apex_y = centerline_y + (T/2) / sin_t for bottom apex
    dy_apex = (T / 2.0) / sin_t

    # So if the bottom apex is at y_bot = 665.0:
    y_center_bot = y_bot - dy_apex
    # And if the top apex is at y_top = 330.0:
    y_center_top = y_top + dy_apex

    H_center = y_center_bot - y_center_top
    dx = H_center * tan_t

    # Total width centering in 1000x1000 canvas
    # Let C center be at cx_c = 740.0, cy_c = 497.5
    # C outer radius R_out = 168.0, R_in = 92.0
    # Rightmost point of C = cx_c + R_out = 908.0
    # Leftmost point of W = x_left_top ~ 100.0
    # Center = (100 + 908) / 2 = 504 ~ 500 (perfect!)

    # Let x_B (apex of V1) be around 255.0
    x_B = 255.0
    x_A = x_B - dx
    x_C = x_B + dx
    x_D = x_C + dx
    x_E = x_D + dx

    # Apex points:
    V1_bottom_apex = (x_B, y_bot)
    V2_top_apex    = (x_C, y_top)
    V3_bottom_apex = (x_D, y_bot)

    # Crotch points:
    C1_crotch = (x_B, y_center_bot - dy_apex) # = y_bot - 2*dy_apex
    C_mid_crotch = (x_C, y_center_top + dy_apex) # = y_top + 2*dy_apex
    C2_crotch = (x_D, y_center_bot - dy_apex)

    # Top caps of Leg 1 and Leg 4:
    # Top of Leg 1 is cut horizontally at y = y_top:
    # Leg 1 left edge: passes through V1_bottom_apex (x_B, y_bot) with slope dy/dx = 1/tan(theta)
    # x(y) = x_B - (y_bot - y) * tan_t
    # At y = y_top:
    x_leg1_top_left = x_B - (y_bot - y_top) * tan_t
    # Leg 1 right edge passes through C1_crotch:
    # x(y) = x_B - (C1_crotch[1] - y) * tan_t ... wait!
    # Leg 1 right edge is parallel to left edge, shifted horizontally by T / cos(theta):
    W_h = T / cos_t
    x_leg1_top_right = x_leg1_top_left + W_h

    # Leg 4 top cap:
    # Leg 4 right edge passes through V3_bottom_apex (x_D, y_bot) with slope dy/dx = -1/tan(theta):
    # x(y) = x_D + (y_bot - y) * tan_t
    x_leg4_top_right = x_D + (y_bot - y_top) * tan_t
    x_leg4_top_left = x_leg4_top_right - W_h

    print(f"dy_apex = {dy_apex:.1f}, W_h = {W_h:.1f}")
    print(f"x_leg1_top_left = {x_leg1_top_left:.1f}, x_leg1_top_right = {x_leg1_top_right:.1f}")
    print(f"V1 = {V1_bottom_apex}, C1 = {C1_crotch}")
    print(f"V2 = {V2_top_apex}, C_mid = {C_mid_crotch}")
    print(f"V3 = {V3_bottom_apex}, C2 = {C2_crotch}")
    print(f"x_leg4_top_left = {x_leg4_top_left:.1f}, x_leg4_top_right = {x_leg4_top_right:.1f}")

solve()
