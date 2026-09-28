// src/screens/SplashScreen.jsx
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated,
  Easing, StatusBar, Dimensions, Image
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ onFinish }) {
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(1.08)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const flagWidth = useRef(new Animated.Value(0)).current;
  const subOpacity = useRef(new Animated.Value(0)).current;
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  // Lèt "Please SaveMe" yo
  const letters = 'Please SaveMe'.split('');
  const letterAnims = useRef(
    letters.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    startAnimation();
  }, []);

  const startAnimation = () => {
    // Kurseur kliyote
    Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(cursorOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();

    Animated.sequence([
      // 1. Imaj parèt (0.8s)
      Animated.parallel([
        Animated.timing(imageOpacity, {
          toValue: 1, duration: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(imageScale, {
          toValue: 1, duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),

      // 2. Logo parèt (0.5s)
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1, duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1, tension: 60, friction: 7,
          useNativeDriver: true,
        }),
      ]),

      // 3. Tèks "Please SaveMe" lèt pa lèt (1.5s)
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1, duration: 300,
          useNativeDriver: true,
        }),
        Animated.stagger(80,
          letterAnims.map(anim =>
            Animated.timing(anim, {
              toValue: 1, duration: 250,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            })
          )
        ),
      ]),

      // 4. Drapo ak sous-tit (0.6s)
      Animated.parallel([
        Animated.timing(flagWidth, {
          toValue: width, duration: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(subOpacity, {
          toValue: 1, duration: 600,
          useNativeDriver: true,
        }),
      ]),

      // 5. Tann 5 segonn total (rès tan an)
      Animated.delay(1500),

    ]).start(() => {
      onFinish?.();
    });
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDF0F5" />

      {/* Imaj fi a */}
      <Animated.View style={[s.imageContainer, {
        opacity: imageOpacity,
        transform: [{ scale: imageScale }],
      }]}>
        <Image
          source={require('../../assets/splash.png')}
          style={s.image}
          resizeMode="cover"
        />
        <View style={s.imageFade} />
      </Animated.View>

      {/* Kontni anba */}
      <View style={s.bottomContent}>

        {/* Logo */}
        <Animated.View style={[s.logoContainer, {
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
        }]}>
          <Image
            source={require('../../assets/logo_save_me.png')}
            style={s.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Divider kè */}
        <Animated.View style={[s.dividerRow, { opacity: textOpacity }]}>
          <View style={s.divLine} />
          <Text style={s.divHeart}>♥</Text>
          <View style={s.divLine} />
        </Animated.View>

        {/* "Please SaveMe" lèt pa lèt */}
        <Animated.View style={[s.pleaseRow, { opacity: textOpacity }]}>
          {letters.map((letter, i) => (
            <Animated.Text
              key={i}
              style={[
                i >= 7 ? s.letterRed : s.letterBlue,
                {
                  opacity: letterAnims[i],
                  transform: [{
                    translateY: letterAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  }],
                }
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
          <Animated.Text style={[s.cursor, { opacity: cursorOpacity }]}>|</Animated.Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.Text style={[s.tagline, { opacity: subOpacity }]}>
          Protèje · Pataje · Konekte
        </Animated.Text>

        {/* Sous-tit */}
        <Animated.Text style={[s.subTagline, { opacity: subOpacity }]}>
          Byenveni nan SaveMe! ♥
        </Animated.Text>
      </View>

      {/* Drapo Ayisyen anba */}
      <Animated.View style={[s.flagBar, { width: flagWidth }]}>
        <View style={s.flagBlue} />
        <View style={s.flagRed} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF0F5',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageContainer: {
    width: '100%',
    height: height * 0.52,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFade: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 100,
    backgroundColor: 'transparent',
    backgroundImage: 'linear-gradient(transparent, #FDF0F5)',
  },
  bottomContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 6,
    paddingBottom: 16,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  divLine: {
    height: 1,
    width: 30,
    backgroundColor: '#1565C0',
  },
  divHeart: {
    color: '#D32F2F',
    fontSize: 12,
  },
  pleaseRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  letterBlue: {
    fontFamily: 'serif',
    fontSize: 22,
    fontStyle: 'italic',
    fontWeight: '700',
    color: '#1565C0',
  },
  letterRed: {
    fontFamily: 'serif',
    fontSize: 22,
    fontStyle: 'italic',
    fontWeight: '700',
    color: '#D32F2F',
  },
  cursor: {
    fontSize: 22,
    color: '#D32F2F',
    fontStyle: 'italic',
  },
  tagline: {
    fontSize: 9,
    color: '#999',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'serif',
    marginTop: 4,
  },
  subTagline: {
    fontFamily: 'serif',
    fontStyle: 'italic',
    fontSize: 13,
    color: '#1565C0',
    letterSpacing: 0.5,
  },
  flagBar: {
    height: 5,
    flexDirection: 'row',
    alignSelf: 'flex-start',
  },
  flagBlue: {
    flex: 1,
    backgroundColor: '#1565C0',
  },
  flagRed: {
    flex: 1,
    backgroundColor: '#D32F2F',
  },
});
