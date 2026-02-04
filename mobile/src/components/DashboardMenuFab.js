import React, { useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import RadialMenuFab from "./RadialMenuFab";

export default function DashboardMenuFab() {
  const navigation = useNavigation();

  const items = useMemo(
    () => [
      {
        key: "dashboard",
        label: "Dashboard",
        icon: "🏠",
        onPress: () => navigation.navigate("Dashboard"),
      },
      {
        key: "ai",
        label: "AI Mentor",
        icon: "🤖",
        onPress: () => navigation.navigate("Financial Helper"),
      },
      {
        key: "expenses",
        label: "Expenses",
        icon: "💸",
        onPress: () => navigation.navigate("Expenses"),
      },
      {
        key: "income",
        label: "Income",
        icon: "💰",
        onPress: () => navigation.navigate("Income"),
      },
      {
        key: "investments",
        label: "Investments",
        icon: "📈",
        onPress: () => navigation.navigate("Investments"),
      },
      {
        key: "reports",
        label: "Reports",
        icon: "📄",
        onPress: () => navigation.navigate("Reports"),
      },

      // NOTE: only works if "User" route exists in your navigator
      {
        key: "profile",
        label: "Profile",
        icon: "👤",
        onPress: () => navigation.navigate("User"),
      },

      {
        key: "scan",
        label: "Scan Receipt",
        icon: "📸",
        onPress: () => navigation.navigate("ScanReceipt"),
      },
    ],
    [navigation],
  );

  return (
    <RadialMenuFab
      items={items}
      placement="bottom-right"
      radius={130}
      startAngle={-60}
      endAngle={-170}
      buttonSize={58}
      mainSize={70}
    />
  );
}
