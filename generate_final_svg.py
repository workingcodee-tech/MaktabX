import math

def create_logo_svg():
    # 1. Colors
    DARK = "#1A2232"  # Charcoal slate navy
    BLUE = "#0066FF"  # Electric blue
    WHITE = "#FFFFFF"

    # 2. Dimensions
    y_top = 330.0
    y_bot = 665.0
    H = y_bot - y_top # 335.0

    theta = math.radians(24.0)
    dx = H * math.tan(theta) # 149.15
    W_top = 96.0

    # Key vertices
    x_v1 = 244.2
    x_v2 = 393.3
    x_v3 = 542.5

    x1_top = x_v1 - dx # 95.05
    x2_top = x1_top + W_top # 191.05

    # Crotch between Leg 1 and Leg 2 (inner V1)
    y_crotch1 = y_top + (x_v2 - W_top - x2_top) / (2 * math.tan(theta))
    x_crotch1 = x2_top + (y_crotch1 - y_top) * math.tan(theta)

    # Crotch between Leg 2 and Leg 3 (inner peak V2)
    # Right edge of Leg 2: from (x_v1 + W_top, y_bot) to (x_v2, y_top)
    # Left edge of Leg 3: from (x_v2, y_top) to (x_v3 - W_top, y_bot)
    # Their inner crotch below V2:
    y_crotch_mid = y_bot - (x_v3 - W_top - (x_v1 + W_top)) / (2 * math.tan(theta))
    x_crotch_mid = (x_v1 + W_top) + (y_bot - y_crotch_mid) * math.tan(theta)

    # Crotch between Leg 3 and Leg 4 (inner V2)
    y_crotch2 = y_crotch1
    x_crotch2 = x_crotch1 + (x_v3 - x_v1)

    # 3. "C" parameters
    cx_c = 737.5
    cy_c = (y_top + y_bot) / 2.0 # 497.5
    R_out = 167.5
    R_in = 92.0

    # Terminals of C (32 degrees)
    term_ang = math.radians(32.0)
    cos_t = math.cos(term_ang)
    sin_t = math.sin(term_ang)

    top_term_out = (cx_c + R_out * cos_t, cy_c - R_out * sin_t)
    top_term_in  = (cx_c + R_in  * cos_t, cy_c - R_in  * sin_t)
    bot_term_in  = (cx_c + R_in  * cos_t, cy_c + R_in  * sin_t)
    bot_term_out = (cx_c + R_out * cos_t, cy_c + R_out * sin_t)

    # 4. Leg 4 and Slit
    # Leg 4 top:
    leg4_top_left = x_v3 + dx - W_top # 595.6
    leg4_top_right = x_v3 + dx # 691.6

    # Slit cut line angle: -30 degrees
    # Let slit be at y_mid ≈ 428
    # Dark piece bottom cut line:
    dark_cut_y_left = 414.0
    dark_cut_x_left = leg4_top_left - (dark_cut_y_left - y_top) * math.tan(theta)
    # cut line slope: dy/dx = tan(-28 deg) = -0.5317
    # So y - y0 = m * (x - x0) -> y = y0 + m * (x - x0)
    m_cut = -0.52
    dark_cut_x_right = leg4_top_right - (dark_cut_y_left - y_top) * math.tan(theta) + 12.0
    dark_cut_y_right = dark_cut_y_left + m_cut * (dark_cut_x_right - dark_cut_x_left)

    # Slit gap: 15px
    slit_gap = 16.0
    blue_cut_x_left = dark_cut_x_left + slit_gap * math.sin(math.atan(-m_cut))
    blue_cut_y_left = dark_cut_y_left + slit_gap * math.cos(math.atan(-m_cut))
    blue_cut_x_right = dark_cut_x_right + slit_gap * math.sin(math.atan(-m_cut))
    blue_cut_y_right = dark_cut_y_right + slit_gap * math.cos(math.atan(-m_cut))

    # Path 1: Main Dark W (Leg 1, Leg 2, Leg 3)
    path_dark_w = f"""M {x1_top:.1f} {y_top:.1f} 
L {x2_top:.1f} {y_top:.1f} 
L {x_crotch1:.1f} {y_crotch1:.1f} 
L {x_v2:.1f} {y_top:.1f} 
L {x_v2 + W_top:.1f} {y_top:.1f} 
L {x_crotch2:.1f} {y_crotch2:.1f} 
L {x_v3:.1f} {y_bot:.1f} 
L {x_v3 - W_top:.1f} {y_bot:.1f} 
L {x_crotch_mid:.1f} {y_crotch_mid:.1f} 
L {x_v1 + W_top:.1f} {y_bot:.1f} 
L {x_v1:.1f} {y_bot:.1f} 
Z"""

    # Path 2: Dark upper piece of Leg 4
    path_dark_leg4 = f"""M {leg4_top_left:.1f} {y_top:.1f}
L {leg4_top_right:.1f} {y_top:.1f}
L {dark_cut_x_right:.1f} {dark_cut_y_right:.1f}
L {dark_cut_x_left:.1f} {dark_cut_y_left:.1f}
Z"""

    print("Path calculations successful")

create_logo_svg()
