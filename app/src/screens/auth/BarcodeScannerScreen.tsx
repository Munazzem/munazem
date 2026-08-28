import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography, textStyles } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { Button } from '../../components/common/Button';
import { AuthApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { ArrowRight, QrCode, Keyboard } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const SCANNER_SIZE = Math.min(width - 64, 260);

type Props = NativeStackScreenProps<AuthStackParamList, 'BarcodeScanner'>;

export const BarcodeScannerScreen: React.FC<Props> = ({ route, navigation }) => {
  const parentPhone = route.params?.parentPhone;
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    try {
      let rawBarcode = data.trim();
      const uuidMatch = rawBarcode.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (uuidMatch) {
        rawBarcode = uuidMatch[0];
      }

      const response = await AuthApi.verifyBarcode({
        barcode: rawBarcode,
        ...(parentPhone ? { parentPhone } : {}),
      });

      await setSession({
        parent: response.parent,
        accessToken: response.token,
        refreshToken: response.refreshToken,
        discoveredStudents: response.discoveredStudents || [],
      });

      if (response.discoveredStudents && response.discoveredStudents.length > 0) {
        navigation.replace('AutoDiscoveryConfirm', {
          discoveredStudents: response.discoveredStudents,
        });
      }
    } catch (error: any) {
      let message = 'لم نتمكن من مطابقة الكارت. تأكد من مسح كارت صالح تابع لمنصة منظم.';
      if (error?.response?.data?.message) {
        message = error.response.data.message;
      } else if (!error?.response) {
        message = 'تعذر الاتصال بالخادم. يرجى التأكد من اتصالك بالإنترنت والمحاولة مجدداً.';
      }
      Alert.alert('تعذر التحقق', message, [
        { text: 'حاول مرة أخرى', onPress: () => setScanned(false) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.infoText}>جاري التحقق من إذن الكاميرا...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <View style={styles.permissionBox}>
          <QrCode size={56} color={colors.primary} />
          <Text style={styles.permissionTitle}>نحتاج إذن الكاميرا</Text>
          <Text style={styles.permissionSubtitle}>
            يرجى السماح للتطبيق باستخدام الكاميرا لمسح كارت الطالب الذكي وتسجيل الحضور
          </Text>
          <Button
            title="منح الإذن"
            onPress={requestPermission}
            variant="primary"
            size="md"
            style={styles.permButton}
          />
          <Button
            title="إدخال الكود يدوياً"
            onPress={() => navigation.navigate('ManualBarcode', { parentPhone })}
            variant="outline"
            size="md"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'code128', 'ean13'],
        }}
      />

      {/* Dark Overlay with Transparent Viewfinder */}
      <SafeAreaView style={styles.overlayContainer}>
        {/* Top Bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <ArrowRight size={22} color={colors.textInverse} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>مسح كارت الطالب</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Viewfinder Target Frame */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.scannerFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.scannerInstruction}>
            وجّه الكاميرا نحو رمز الـ QR على كارت الطالب
          </Text>
        </View>

        {/* Bottom Fallback Action */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) + spacing.md }]}>
          <Button
            title="إدخال رمز الكارت يدوياً"
            onPress={() => navigation.navigate('ManualBarcode', { parentPhone })}
            variant="secondary"
            size="md"
            icon={<Keyboard size={18} color={colors.text} />}
            style={styles.manualBtn}
          />
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  infoText: {
    ...textStyles.body,
    color: colors.textSecondary,
  },
  permissionBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  permissionTitle: {
    ...textStyles.h2,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  permissionSubtitle: {
    ...textStyles.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  permButton: {
    width: '100%',
    marginBottom: spacing.sm,
  },
  overlayContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: colors.textInverse,
  },
  placeholder: {
    width: 40,
  },
  viewfinderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrame: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.primaryLight,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  scannerInstruction: {
    fontFamily: typography.medium,
    fontSize: 14,
    color: colors.textInverse,
    marginTop: spacing.xl,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bottomBar: {
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  manualBtn: {
    width: '100%',
  },
});
