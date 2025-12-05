// mobile/src/navigation/AppTabs.js
import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import DashboardScreen from "../screens/DashboardScreen";
import UserScreen from "../screens/UserScreen";
import ExpensesScreen from "../screens/ExpenseScreen";
import IncomeScreen from "../screens/IncomeScreen";
import InvestmentScreen from "../screens/InvestmentScreen";
import FinancialAdvisorScreen from "../screens/FinancialAdvisorScreen";
import ReportsScreen from "../screens/ReportsScreen";
const Tab = createBottomTabNavigator();

const BRAND_CARD = "#020819";
const BRAND_GREEN = "#22c55e";
const TEXT_MUTED = "rgba(148,163,184,1)";

function TabLabel({ label, focused }) {
  return (
    <Text
      style={{
        fontSize: 11,
        color: focused ? BRAND_GREEN : TEXT_MUTED,
        fontWeight: focused ? "700" : "500",
      }}
    >
      {label}
    </Text>
  );
}

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: BRAND_CARD },
        headerTintColor: "#e5e7eb",
        headerTitleStyle: { fontWeight: "700" },
        tabBarStyle: {
          backgroundColor: BRAND_CARD,
          borderTopColor: "rgba(148,163,184,0.2)",
        },
        tabBarActiveTintColor: BRAND_GREEN,
        tabBarInactiveTintColor: TEXT_MUTED,
        // ⬇️ explicitly booleans, no magic
        tabBarShowLabel: true,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: "Dashboard",
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Home" focused={focused} />
          ),
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>{focused ? "🏠" : "🏚️"}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Financial Helper"
        component={FinancialAdvisorScreen}
        options={{
          title: "Financial Helper",
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Financial Helper" focused={focused} />
          ),
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>{focused ? "🤖" : "🤖"}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Expenses"
        component={ExpensesScreen}
        options={{
          title: "Expenses",
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Expenses" focused={focused} />
          ),
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>{focused ? "💸" : "💸"}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Income"
        component={IncomeScreen}
        options={{
          title: "Income",
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Income" focused={focused} />
          ),
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>{focused ? "💰" : "💰"}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Investments"
        component={InvestmentScreen}
        options={{
          title: "Investments",
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Investments" focused={focused} />
          ),
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>{focused ? "📈" : "📈"}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          title: "Reports",
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Reports" focused={focused} />
          ),
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 18 }}>{focused ? "📄" : "📄"}</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
