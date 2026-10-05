import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSupabaseClient } from './supabase';
import appConfig from '../../app.json';
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowAlert:true,shouldPlaySound:true,shouldSetBadge:true})});
export async function enableNotifications() {
 if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('messages',{name:'Save Me',importance:Notifications.AndroidImportance.HIGH,showBadge:true,lockscreenVisibility:Notifications.AndroidNotificationVisibility.PRIVATE});
 let permission=await Notifications.getPermissionsAsync();
 if(!permission.granted)permission=await Notifications.requestPermissionsAsync();
 if(!permission.granted)return 'denied';
 const projectId=process.env.EXPO_PUBLIC_EAS_PROJECT_ID || appConfig.expo.extra?.eas?.projectId;
 if(!projectId || !/^[0-9a-f-]{36}$/i.test(projectId))return 'local';
 const {data:token}=await Notifications.getExpoPushTokenAsync({projectId});
 const {error}=await getSupabaseClient().rpc('register_push',{p_token:token});if(error)throw error;
 return 'remote';
}
export async function disableAccountNotifications() {
 const {error}=await getSupabaseClient().rpc('unregister_push');
 // Older servers have no token registration; other failures must be shown before logout.
 if(error && !['PGRST202','42883'].includes(error.code))throw error;
 await Notifications.dismissAllNotificationsAsync();await Notifications.setBadgeCountAsync(0);
}
export { Notifications };
