import { DataTypes, Model, Optional } from 'sequelize';
import bcrypt from 'bcrypt';
import { sequelize } from '../config';

export interface UserAttrs {
  id: string;
  name: string;
  email: string;
  password: string;
  isVerified: boolean;
  verificationAttempts: number;
  verificationOtp: string | null;
  verificationOtpExpiry: Date | null;
  resetToken: string | null;
  resetTokenExpiry: Date | null;
}

type UserCreationAttrs = Optional<UserAttrs, 'id' | 'verificationAttempts' | 'isVerified' | 'verificationOtp' | 'verificationOtpExpiry' | 'resetToken' | 'resetTokenExpiry'>;

class User extends Model<UserAttrs, UserCreationAttrs> implements UserAttrs {
  declare id: string; declare name: string; declare email: string; declare password: string;
  declare verificationAttempts: number;
  declare isVerified: boolean; declare verificationOtp: string | null; declare verificationOtpExpiry: Date | null;
  declare resetToken: string | null; declare resetTokenExpiry: Date | null;
  async comparePassword(candidate: string): Promise<boolean> { return bcrypt.compare(candidate, this.password); }
}

User.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  verificationAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  verificationOtp: { type: DataTypes.STRING, allowNull: true },
  verificationOtpExpiry: { type: DataTypes.DATE, allowNull: true },
  resetToken: { type: DataTypes.STRING, allowNull: true },
  resetTokenExpiry: { type: DataTypes.DATE, allowNull: true },
}, {
  sequelize,
  tableName: 'users',
  indexes: [{ unique: true, fields: ['email'] }],
  hooks: {
    beforeCreate: async (user) => { user.password = await bcrypt.hash(user.password, 10); },
    beforeUpdate: async (user) => { if (user.changed('password')) user.password = await bcrypt.hash(user.password, 10); },
  },
});

export default User;
