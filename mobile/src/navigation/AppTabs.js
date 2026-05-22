// mobile/src/navigation/AppTabs.js
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import DashboardScreen from "../screens/DashboardScreen";
import ExpensesScreen from "../screens/ExpenseScreen";
import IncomeScreen from "../screens/IncomeScreen";
import InvestmentScreen from "../screens/InvestmentScreen";
import FinancialAdvisorScreen from "../screens/FinancialAdvisorScreen";
import ScanReceiptScreen from "../screens/ScanReceiptScreen";

const Tab = createBottomTabNavigator();

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Financial Helper" component={FinancialAdvisorScreen} />
      <Tab.Screen name="Expenses" component={ExpensesScreen} />
      <Tab.Screen name="Income" component={IncomeScreen} />
      <Tab.Screen name="Investments" component={InvestmentScreen} />
      <Tab.Screen name="ScanReceipt" component={ScanReceiptScreen} />
    </Tab.Navigator>
  );
}
