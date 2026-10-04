import math

# Let us check the visual representation of W with sharp peaks at V1, V2, V3:
# If V2 is a sharp peak pointing UP:
# Its left slope must go down-left (Leg 2 outer/upper edge).
# Its right slope must go down-right (Leg 3 outer/upper edge).
# That means Leg 2 UPPER edge goes to V2.
# Leg 3 UPPER edge goes to V2.
# What is the upper edge of Leg 2?
# Leg 2 goes up-right: its upper edge is its LEFT edge!
# Leg 3 goes down-right: its upper edge is its RIGHT edge!
# So Leg 2 left edge and Leg 3 right edge meet at V2!
# And the inner edges (Leg 2 right edge and Leg 3 left edge) meet below V2 at Crotch_mid!
# Let us verify this!
