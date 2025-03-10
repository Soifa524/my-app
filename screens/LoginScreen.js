import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      Alert.alert("Login Successful");
    } catch (error) {
      Alert.alert("Login Failed", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Email" 
        value={email} 
        onChangeText={setEmail} 
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput 
        style={styles.input} 
        placeholder="Password" 
        value={password} 
        onChangeText={setPassword} 
        secureTextEntry 
      />
      <Button title="Login" onPress={handleLogin} />
      <Text 
        style={styles.link} 
        onPress={() => navigation.navigate('Register')}
      >
        Don't have an account? Register
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: { width: '80%', padding: 10, borderWidth: 1, marginBottom: 10, borderRadius: 5 },
  link: { marginTop: 10, color: 'blue' }
});
