import pandas as pd
import random

# Load your food.csv (make sure it's in the same folder)

foods = pd.read_excel(r"F:\majorprog\food.csv.xlsx")

# Example health conditions
conditions = ["diabetes", "hypertension", "obesity", "normal"]

# Generate synthetic users
users = []
for i in range(1, 21):  # 20 users
    age = random.randint(20, 65)
    weight = random.randint(50, 90)
    height = random.randint(150, 180)
    bmi = round(weight / ((height / 100) ** 2), 2)
    condition = random.choice(conditions)
    budget = random.choice([200, 250, 300, 350, 400])
    users.append({
        "user_id": i,
        "age": age,
        "weight": weight,
        "height": height,
        "bmi": bmi,
        "condition": condition,
        "budget": budget
    })

# Build dataset by combining users + foods
dataset = []
for user in users:
    for _, food in foods.iterrows():
        rating = random.randint(1, 5)  # simulated feedback
        simulated_price = random.randint(20, 100)  # 👈 add here

        dataset.append({
            "user_id": user["user_id"],
            "age": user["age"],
            "bmi": user["bmi"],
            "condition": user["condition"],
            "budget": user["budget"],
            "food": food["food"],
            "calories": food["calories"],
            "protein": food["protein"],
            "carbs": food["carbs"],
            "fat": food["fat"],
            "safe_for": food["safe_for"],   # keep your extra columns
            "meal": food["meal"],
            "price": simulated_price,       # 👈 use simulated price here
            "rating": rating
        })

# Convert to DataFrame
df = pd.DataFrame(dataset)

# Save to CSV
df.to_csv("training_dataset.csv", index=False)

print("✅ training_dataset.csv generated with", len(df), "rows")
