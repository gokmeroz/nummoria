// mobile/src/screens/SplashGateScreen.js
import React, { useEffect } from "react";
import { View, Text, StyleSheet, Image } from "react-native";

const BG = "#020617";
const TEXT = "#e5e7eb";

export default function SplashGateScreen({ navigation, route }) {
  const nextRoute = route?.params?.nextRoute || "Login";

  useEffect(() => {
    const t = setTimeout(() => {
      navigation.replace(nextRoute);
    }, 2000);

    return () => clearTimeout(t);
  }, [navigation, nextRoute]);

  return (
    <View style={styles.root}>
      <Image
        source={require("../../assets/nummoria_logo.png")}
        style={styles.image}
        resizeMode="contain"
      />
      {/* If you want just logo+name instead of full image, I can adjust */}
      <Text style={styles.brand}>Nummoria</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  image: {
    width: 260,
    height: 260,
  },
  brand: {
    marginTop: 18,
    color: TEXT,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
