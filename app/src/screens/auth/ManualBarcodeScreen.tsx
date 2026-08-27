import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { textStyles } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { AuthApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { KeyRound, ShieldCheck } from 'lucide-react-native';

type Props = NativeStackScreenProps<AuthStackParamList, 'ManualBarcode'>;

export const ManualBarcodeScreen: React.FC<Props> = ({ route, navigation }) => {
  const parentPhone = route.params?.parentPhone;
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();
  const setSession = useAuthStore((state) => state.setSession);

  const handleVerify = async () => {
    const trimmed = barcode.trim();
    if (!trimmed) {
      setError('يرجى إدخال كود أو رمز بطاقة الطالب');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await AuthApi.verifyBarcode({
        barcode: trimmed,
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
    } catch (err: any) {
      let msg = 'لم نتمكن من مطابقة الرمز. يرجى التأكد من الرمز والمحاولة مجدداً.';
      if (err?.response?.data?.message) {
        msg = err.response.data.message;
      } else if (!err?.response) {
        msg = 'تعذر الاتصال بالخادم. يرجى التأكد من اتصالك بالإنترنت والمحاولة مجدداً.';
      }
      Alert.alert('تعذر التحقق', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 24) + spacing.md },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topSection}>
              <View style={styles.header}>
                <Text style={styles.title}>إدخال رمز البطاقة يدوياً</Text>
                <Text style={styles.subtitle}>
                  أدخل كود الطالب أو رقم الكارت المطبوع على بطاقة الطالب
                </Text>
              </View>

              <View style={styles.form}>
                <Input
                  label="كود أو رمز الطالب"
                  placeholder="مثال: 12A أو MNZ-XXXX-00001"
                  value={barcode}
                  onChangeText={(t) => {
                    setBarcode(t);
                    if (error) setError('');
                  }}
                  error={error}
                  leftIcon={<KeyRound size={20} color={colors.textMuted} />}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
              </View>
            </View>

            <View style={styles.footer}>
              <Button
                title="تحقق ودخول"
                onPress={handleVerify}
                loading={loading}
                size="lg"
                variant="primary"
                icon={<ShieldCheck size={20} color={colors.textInverse} />}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    justifyContent: 'space-between',
  },
  topSection: {
    marginTop: spacing.md,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...textStyles.h2,
    color: colors.text,
    textAlign: 'right',
  },
  subtitle: {
    ...textStyles.body,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  form: {
    marginTop: spacing.md,
  },
  footer: {
    marginTop: spacing.xl,
  },
});
