import pandas as pd
import sqlite3

# Load dataset using full path
df = pd.read_excel(r"F:\majorprog\food.csv.xlsx")

# Save to SQLite
conn = sqlite3.connect("diet_planner.db")
df.to_sql("foods", conn, if_exists="replace", index=False)
conn.close()

print("Foods dataset imported successfully!")
