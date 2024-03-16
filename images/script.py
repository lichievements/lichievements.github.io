from PIL import Image, ImageDraw
import chess

# Chessboard parameters
square_size = 128  # Size of a chess square
board_origin = (0, 0)  # Top-left corner of chessboard
RADIUS = 40 # size of pieces

# Create an image with a white background
img = Image.new("RGB", (1024,1024), "#FFFFFF")
draw = ImageDraw.Draw(img)

# Function to reset all pieces
def reset_board():

    # Size of a single square and piece
    square_size = 1024 // 8

    # Create chessboard 
    for i in range(8):
        for j in range(8):
            # Determine the color of the square
            if (i + j) % 2 == 0:
                color = "#E7C590"  # White
            else:
                color = "#A18964"  # Black
            
            # Calculate the top-left and bottom-right coordinates of the square
            top_left = (j * square_size, i * square_size)
            bottom_right = ((j + 1) * square_size, (i + 1) * square_size)
            
            # Draw the rectangle
            draw.rectangle([top_left, bottom_right], color)

# Function to convert chess square notation (e.g., "a1") to pixel coordinates
def square_to_pixels(square):
    # Chessboard rows and columns mapping
    columns = "abcdefgh"
    rows = "12345678"
    
    col, row = square[0], square[1]
    
    # Calculate the pixel position of the center of the square
    x = columns.index(col) * square_size + square_size // 2
    y = (8 - rows.index(row)) * square_size - square_size // 2
    
    return (x, y)

# Draw pieces at specific squares
def draw_pieces(squares, radius, color):
    for square in squares:
        center_x, center_y = square_to_pixels(square)
        
        # Calculate the bounding box for the ellipse
        left_up = (center_x - radius, center_y - radius)
        right_down = (center_x + radius, center_y + radius)
        
        # Draw the piece (circle)
        draw.ellipse([left_up, right_down], fill=color)

def moves_to_fen(moves_string):
    # Create a new chess board
    board = chess.Board()
    
    # Split the moves string into individual moves. Assumes moves are separated by spaces.
    moves = moves_string.split()
    
    # Apply each move to the board
    for move in moves:
        # Convert the move from UCI (Universal Chess Interface) notation
        move = board.parse_san(move)
        board.push(move)
    
    # Generate the FEN string for the current board position
    return board.fen()
    
def fen_to_occupied_squares_by_color(fen):
    # Split the FEN string to get the board layout
    board_layout = fen.split()[0]  # The first part of the FEN string represents the board
    rows = board_layout.split('/')
    
    # Initialize empty lists to store the squares with white and black pieces
    white_squares = []
    black_squares = []
    
    # Rows are from 8 to 1, and columns are from 'a' to 'h'
    for row_index, row in enumerate(rows):
        col_index = 0  # Column index, from 'a' (0) to 'h' (7)
        for char in row:
            if char.isdigit():
                # Empty squares, move ahead by the number of empty squares
                col_index += int(char)
            else:
                # Calculate the square position
                row_name = 8 - row_index  # Convert row_index to actual row number (8 to 1)
                col_name = chr(ord('a') + col_index)  # Convert col_index to column name ('a' to 'h')
                square = f"{col_name}{row_name}"
                
                # Determine the piece color and add the square to the corresponding list
                if char.isupper():
                    white_squares.append(square)
                else:
                    black_squares.append(square)
                
                col_index += 1
                
    return white_squares, black_squares

def printOpening(name, moves):
    fen = moves_to_fen(moves)
    squaresWhite, squaresBlack = fen_to_occupied_squares_by_color(fen)
    reset_board()
    draw_pieces(squaresWhite, RADIUS, "#FFFFFF")
    draw_pieces(squaresBlack, RADIUS, "#000000")
    img.save("opening-" + name + ".png")

# Finally we can print the opening images
# WHITE
printOpening("italian", "e4 e5 Nf3 Nc6 Bc4")
printOpening("ruylopez", "e4 e5 Nf3 Nc6 Bb5")
printOpening("scotch", "e4 e5 Nf3 Nc6 d4")
printOpening("queensgambit", "d4 d5 c4")
printOpening("kingsgambit", "e4 e5 f4")
printOpening("english", "c4")
printOpening("reti", "Nf3")
printOpening("grob", "g4")
printOpening("bongcloud", "e4 e5 Ke2")
printOpening("huebschgambit", "d4 d5 Nc3 Nf6 e4")
# BLACK
printOpening("sicilian", "e4 c5")
printOpening("carokann", "e4 c6")
printOpening("scandinavian", "e4 d5")
printOpening("pirc", "e4 d6")
printOpening("french", "e4 e6")
printOpening("doublebongcloud", "e4 e5 Ke2 Ke7")



