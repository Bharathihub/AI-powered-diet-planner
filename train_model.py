import pandas as pd
from sklearn.tree import DecisionTreeClassifier
import joblib

df = pd.read_csv("training_dataset.csv")

X = df[["age", "bmi", "budget", "calories", "protein", "carbs", "fat", "price"]]
y = df["rating"]

model = DecisionTreeClassifier()
model.fit(X, y)

joblib.dump(model, "diet_model.pkl")
print("✅ Model trained and saved!")
