import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../../theme/colors';
import { textStyles, typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { StudentCardData } from '../../types/child.types';
import { X, Sparkles, User, GraduationCap, School, QrCode as QrIcon } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 48, 360);

interface StudentQrCardModalProps {
  visible: boolean;
  onClose: () => void;
  cardData: StudentCardData | {
    studentName: string;
    studentCode?: string;
    gradeLevel?: string;
    qrValue?: string;
    centerName?: string;
    teacherName?: string;
    groupName?: string;
  } | null;
}

export const StudentQrCardModal: React.FC<StudentQrCardModalProps> = ({
  visible,
  onClose,
  cardData,
}) => {
  if (!cardData) return null;

  const qrString = cardData.qrValue || (cardData as any).barcode || (cardData as any).studentCode || 'MONAZEM-STUDENT';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.cardContainer}>
              {/* Header Bar */}
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={20} color={colors.textInverse} />
                </TouchableOpacity>

                <View style={styles.brandContainer}>
                  <Text style={styles.brandTitle}>منظّم</Text>
                  <Sparkles size={14} color={colors.warning} />
                </View>
              </View>

              {/* Card Body */}
              <View style={styles.cardContent}>
                {/* Badge */}
                <View style={styles.badgeRow}>
                  <View style={styles.cardTypeBadge}>
                    <QrIcon size={12} color={colors.primary} />
                    <Text style={styles.cardTypeBadgeText}>كارت الطالب الذكي</Text>
                  </View>
                  {cardData.studentCode ? (
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeBadgeText}>كود: {cardData.studentCode}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Student Info */}
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName} numberOfLines={1}>
                    {cardData.studentName}
                  </Text>
                  {cardData.gradeLevel ? (
                    <Text style={styles.gradeText}>{cardData.gradeLevel}</Text>
                  ) : null}
                </View>

                {/* QR Code Container */}
                <View style={styles.qrWrapper}>
                  <View style={styles.qrFrame}>
                    <QRCode
                      value={qrString}
                      size={180}
                      color={colors.primaryDark}
                      backgroundColor="white"
                    />
                  </View>
                </View>

                {/* Meta details */}
                <View style={styles.metaBox}>
                  {cardData.teacherName ? (
                    <View style={styles.metaRow}>
                      <User size={14} color={colors.textSecondary} />
                      <Text style={styles.metaText}>المعلم: {cardData.teacherName}</Text>
                    </View>
                  ) : null}

                  {cardData.groupName ? (
                    <View style={styles.metaRow}>
                      <School size={14} color={colors.textSecondary} />
                      <Text style={styles.metaText}>المجموعة: {cardData.groupName}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Scanner Tip */}
                <View style={styles.tipContainer}>
                  <Text style={styles.tipText}>
                    وجّه هذا الرمز لجهاز الحضور في السنتر لتسجيل الحضور فورياً
                  </Text>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  cardContainer: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  brandTitle: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: '#ffffff',
  },
  closeBtn: {
    padding: spacing.xs,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  cardContent: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.sm,
  },
  cardTypeBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cardTypeBadgeText: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: '#0284c7',
  },
  codeBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  codeBadgeText: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: '#0f4c81',
  },
  studentInfo: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  studentName: {
    fontFamily: typography.bold,
    fontSize: 20,
    color: '#081a33',
    textAlign: 'center',
  },
  gradeLevel: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  gradeText: {
    fontFamily: typography.medium,
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  qrWrapper: {
    padding: spacing.md,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qrFrame: {
    padding: spacing.xs,
  },
  metaBox: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
    marginVertical: 3,
  },
  metaText: {
    fontFamily: typography.bold,
    fontSize: 13,
    color: '#0f4c81',
    textAlign: 'right',
  },
  tipContainer: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    width: '100%',
  },
  tipText: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: '#0369a1',
    textAlign: 'center',
    lineHeight: 16,
  },
});
