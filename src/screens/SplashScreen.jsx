import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StatusBar, StyleSheet, View } from 'react-native';

const DURATION_MS = 3000;
const ART_RATIO = 9 / 16;

export default function SplashScreen({ onFinish }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const finish = useRef(onFinish);
  finish.current = onFinish;
  const [loaded, setLoaded] = useState(false);
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!loaded) return;
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true,
    });
    animation.start();
    // The fade and reading pause share one three-second window.
    const timer = setTimeout(() => finish.current?.(), DURATION_MS);
    return () => { clearTimeout(timer); animation.stop(); };
  }, [loaded, opacity]);

  // Keep the entire artwork visible, including on short screens and tablets.
  const width = Math.min(layout.width, layout.height * ART_RATIO);
  const height = width / ART_RATIO;
  return <View style={s.container} onLayout={({ nativeEvent }) => setLayout(nativeEvent.layout)}>
    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
    <View style={{ width, height }}>
      <Image source={require('../../assets/splash-welcome-v2.webp')} style={StyleSheet.absoluteFill}
        resizeMode="contain" accessible={false} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} />
      <Animated.View style={[s.greeting, { opacity }]}>
        <Animated.Text accessibilityRole="header" allowFontScaling={false}
          style={[s.welcome, { fontSize: Math.min(width * 0.14, 64) }]}>Welcome</Animated.Text>
        <Animated.Text allowFontScaling={false}
          style={[s.subtitle, { fontSize: Math.min(width * 0.042, 20) }]}>SaveMe please</Animated.Text>
      </Animated.View>
    </View>
  </View>;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  greeting: { position: 'absolute', top: '65%', left: '5%', right: '5%', alignItems: 'center' },
  welcome: { color: '#073CA8', fontWeight: '800', textAlign: 'center', letterSpacing: -1 },
  subtitle: { color: '#2359B0', fontWeight: '400', textAlign: 'center', marginTop: 10, letterSpacing: 0.6 },
});
