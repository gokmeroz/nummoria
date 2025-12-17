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
        onPress: () => navigation.navigate("Dashboard"),
      },
      {
        key: "ai",
        label: "AI Mentor",
        onPress: () => navigation.navigate("Financial Helper"),
      },
      {
        key: "expenses",
        label: "Expenses",
        onPress: () => navigation.navigate("Expenses"),
      },
      {
        key: "income",
        label: "Income",
        onPress: () => navigation.navigate("Income"),
      },
      {
        key: "investments",
        label: "Investments",
        onPress: () => navigation.navigate("Investments"),
      },
      {
        key: "reports",
        label: "Reports",
        onPress: () => navigation.navigate("Reports"),
      },
      {
        key: "profile",
        label: "Profile",
        onPress: () => navigation.navigate("User"),
      },
    ],
    [navigation]
  );

  return <RadialMenuFab items={items} placement="bottom-right" />;
}
