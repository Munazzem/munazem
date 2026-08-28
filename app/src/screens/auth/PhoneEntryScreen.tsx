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
import { isValidEgyptianPhone, normalizeEgyptianPhone } from '../../utils/phone.util';
import { AuthApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { Phone, LogIn, QrCode } from 'lucide-react-native';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneEntry'>;

export const PhoneEntryScreen: React.FC<Props> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();
  const setSession = useAuthStore((state) => state.setSession);

  const handleLogin = async () => {
    const normalized = normalizeEgyptianPhone(phone);
    if (!isValidEgyptianPhone(normalized)) {
      setError('يرجى إدخال رقم هاتف محمول مصري صحيح (01xxxxxxxxx)');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await AuthApi.loginByPhone({
        parentPhone: normalized,
      });

      await setSession({
        parent: response.parent,
        accessToken: response.token,
        refreshToken: response.refreshToken,
        discoveredStudents: response.discoveredStudents || [],
      });
    } catch (err: any) {
      let message = 'لم نتمكن من العثور على طالب مسجل بهذا الرقم. تأكد من صحة الرقم أو جرب مسح كارت الطالب.';
      if (err?.response?.data?.message) {
        message = err.response.data.message;
      } else if (!err?.response) {
        message = 'تعذر الاتصال بالخادم. يرجى التأكد من اتصالك بالإنترنت والمحاولة مجدداً.';
      }
      Alert.alert('تعذر تسجيل الدخول', message, [
        {
          text: 'مسح كارت الطالب',
          onPress: () => navigation.navigate('BarcodeScanner', { parentPhone: normalized }),
        },
        { text: 'حاول مجدداً', style: 'cancel' },
      ]);
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
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>رقم هاتف ولي الأمر</Text>
                <Text style={styles.subtitle}>
                  أدخل رقم هاتفك المسجل لدى المعلم لمتابعة أبنائك فوراً
                </Text>
              </View>

              {/* Input Form */}
              <View style={styles.form}>
                <Input
                  label="رقم الهاتف"
                  placeholder="01012345678"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    if (error) setError('');
                  }}
                  error={error}
                  leftIcon={<Phone size={20} color={colors.textMuted} />}
                  autoFocus
                />
              </View>
            </View>

            {/* Footer Actions with Safe Area Insets */}
            <View style={styles.footer}>
              <Button
                title="تسجيل الدخول"
                onPress={handleLogin}
                loading={loading}
                size="lg"
                variant="primary"
                icon={<LogIn size={20} color={colors.textInverse} />}
                style={styles.loginBtn}
              />
              <Button
                title="أو مسح كارت الطالب بكاميرا الهاتف"
                onPress={() =>
                  navigation.navigate('BarcodeScanner', {
                    parentPhone: phone.trim() || undefined,
                  })
                }
                variant="ghost"
                size="md"
                icon={<QrCode size={18} color={colors.primary} />}
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
    ...textStyles.h1,
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
  loginBtn: {
    marginBottom: spacing.sm,
  },
});
