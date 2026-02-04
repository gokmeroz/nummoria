// mobile/src/navigation/MainStack.js
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import DashboardScreen from "../screens/DashboardScreen";
import ExpensesScreen from "../screens/ExpenseScreen";
import IncomeScreen from "../screens/IncomeScreen";
import InvestmentsScreen from "../screens/InvestmentScreen";
import ReportsScreen from "../screens/ReportsScreen";
import FinancialHelperScreen from "../screens/FinancialAdvisorScreen";
import ScanReceiptScreen from "../screens/ScanReceiptScreen";

const Stack = createNativeStackNavigator();

export default function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Expenses" component={ExpensesScreen} />
      <Stack.Screen name="Income" component={IncomeScreen} />
      <Stack.Screen name="Investments" component={InvestmentsScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Financial Helper" component={FinancialHelperScreen} />
      <Stack.Screen name="ScanReceipt" component={ScanReceiptScreen} />
    </Stack.Navigator>
  );
}
