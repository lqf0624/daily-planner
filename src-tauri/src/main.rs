#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{
  AppHandle, Manager, Emitter,
  tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState}
};
use tauri_plugin_notification::NotificationExt;
use tokio::time::{interval, Duration};

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct PomodoroSettings {
  pub work_duration: u32,
  pub short_break_duration: u32,
  pub long_break_duration: u32,
  pub long_break_interval: u32,
  pub auto_start_breaks: bool,
  pub auto_start_pomodoros: bool,
  pub max_sessions: u32,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct PomodoroState {
  pub time_left: u32,
  pub is_active: bool,
  pub mode: String,
  pub sessions_completed: u32,
  pub settings: PomodoroSettings,
}

struct AppState {
  state: Arc<Mutex<PomodoroState>>,
  config_path: PathBuf,
}

impl Default for PomodoroSettings {
  fn default() -> Self {
    Self {
      work_duration: 25,
      short_break_duration: 5,
      long_break_duration: 15,
      long_break_interval: 4,
      auto_start_breaks: true,
      auto_start_pomodoros: false,
      max_sessions: 8,
    }
  }
}

fn get_config_path(app_handle: &AppHandle) -> PathBuf {
  let path = app_handle.path().app_config_dir().expect("Failed to get config dir");
  if !path.exists() {
    let _ = fs::create_dir_all(&path);
  }
  path.join("pomodoro_settings.json")
}

fn load_settings(path: &PathBuf) -> PomodoroSettings {
  if path.exists() {
    if let Ok(content) = fs::read_to_string(path) {
      if let Ok(settings) = serde_json::from_str::<PomodoroSettings>(&content) {
        return settings;
      }
    }
  }
  PomodoroSettings::default()
}

fn save_settings(path: &PathBuf, settings: &PomodoroSettings) {
  if let Ok(content) = serde_json::to_string_pretty(settings) {
    let _ = fs::write(path, content);
  }
}

#[tauri::command]
fn get_pomodoro_state(state: tauri::State<'_, AppState>) -> PomodoroState {
  state.state.lock().unwrap().clone()
}

#[tauri::command]
fn toggle_timer(state: tauri::State<'_, AppState>, handle: AppHandle) {
  let mut s = state.state.lock().unwrap();
  s.is_active = !s.is_active;
  let _ = handle.emit("pomodoro_tick", s.clone());
}

#[tauri::command]
fn reset_timer(state: tauri::State<'_, AppState>, handle: AppHandle) {
  let mut s = state.state.lock().unwrap();
  s.is_active = false;
  s.time_left = match s.mode.as_str() {
    "shortBreak" => s.settings.short_break_duration * 60,
    "longBreak" => s.settings.long_break_duration * 60,
    _ => s.settings.work_duration * 60,
  };
  let _ = handle.emit("pomodoro_tick", s.clone());
}

#[tauri::command]
fn skip_mode(state: tauri::State<'_, AppState>, handle: AppHandle) {
  let mut s = state.state.lock().unwrap();
  if s.mode == "work" {
    let is_long = s.sessions_completed > 0 && (s.sessions_completed + 1) % s.settings.long_break_interval == 0;
    s.mode = (if is_long { "longBreak" } else { "shortBreak" }).to_string();
    s.time_left = (if is_long { s.settings.long_break_duration } else { s.settings.short_break_duration }) * 60;
  } else {
    s.mode = "work".to_string();
    s.time_left = s.settings.work_duration * 60;
  }
  s.is_active = false;
  let _ = handle.emit("pomodoro_tick", s.clone());
}

#[tauri::command]
fn update_settings(settings: PomodoroSettings, state: tauri::State<'_, AppState>, handle: AppHandle) {
  let mut s = state.state.lock().unwrap();
  s.settings = settings.clone();
  save_settings(&state.config_path, &s.settings);
  if !s.is_active {
    s.time_left = match s.mode.as_str() {
      "shortBreak" => s.settings.short_break_duration * 60,
      "longBreak" => s.settings.long_break_duration * 60,
      _ => s.settings.work_duration * 60,
    };
  }
  let _ = handle.emit("pomodoro_tick", s.clone());
}

#[tauri::command]
fn open_main(handle: AppHandle) {
  if let Some(window) = handle.get_webview_window("main") {
    let _ = window.show();
    let _ = window.set_focus();
  }
}

#[tauri::command]
async fn toggle_floating_window(handle: AppHandle) {
  if let Some(window) = handle.get_webview_window("floating") {
    // 检查是否可见，实现“开关”逻辑
    let is_visible = window.is_visible().unwrap_or(false);
    if is_visible {
      let _ = window.hide();
    } else {
      // 动态显示窗口，并可以根据需要在这里设置初始置顶状态
      // 由于前端按钮会控制置顶，我们这里只需显示即可
      let _ = window.show();
      let _ = window.set_focus();
    }
  }
}

#[tauri::command]
fn show_notification(title: String, body: String, handle: AppHandle) {
  let _ = handle.notification().builder().title(title).body(body).show();
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      let handle = app.handle().clone();
      let config_path = get_config_path(&handle);
      let settings = load_settings(&config_path);
      
      let initial_state = PomodoroState {
        time_left: settings.work_duration * 60,
        is_active: false,
        mode: "work".to_string(),
        sessions_completed: 0,
        settings,
      };

      let state_ptr = Arc::new(Mutex::new(initial_state));
      let state_for_timer = state_ptr.clone();

      app.manage(AppState {
        state: state_ptr,
        config_path,
      });

      let tray_builder = TrayIconBuilder::with_id("main");
      let _ = match app.default_window_icon() {
        Some(icon) => tray_builder.icon(icon.clone()),
        None => tray_builder,
      }
      .on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click {
          button: MouseButton::Left,
          button_state: MouseButtonState::Up,
          ..
        } = event {
          let handle = tray.app_handle();
          if let Some(window) = handle.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
          }
        }
      })
      .build(app);

      tauri::async_runtime::spawn(async move {
        let mut interval = interval(Duration::from_secs(1));
        loop {
          interval.tick().await;
          let mut s = state_for_timer.lock().unwrap();
          
          if s.is_active {
            if s.time_left > 0 {
              s.time_left -= 1;
            } else {
              if s.mode == "work" {
                let _ = handle.emit("pomodoro_completed", s.settings.work_duration);
                s.sessions_completed += 1;
                let is_long = s.sessions_completed % s.settings.long_break_interval == 0;
                s.mode = (if is_long { "longBreak" } else { "shortBreak" }).to_string();
                s.time_left = (if is_long { s.settings.long_break_duration } else { s.settings.short_break_duration }) * 60;
                s.is_active = s.settings.auto_start_breaks;
              } else {
                s.mode = "work".to_string();
                s.time_left = s.settings.work_duration * 60;
                s.is_active = s.settings.auto_start_pomodoros;
              }
              
              let _ = handle.notification().builder()
                .title("番茄钟提示")
                .body(if s.mode == "work" { "开始新的专注吧！" } else { "专注完成，休息一下吧。" })
                .show();
            }
            let _ = handle.emit("pomodoro_tick", s.clone());
          }

          let minutes = s.time_left / 60;
          let seconds = s.time_left % 60;
          let status_text = if s.mode == "work" { "专注" } else { "休息" };
          let tray_text = format!("{}: {:02}:{:02}", status_text, minutes, seconds);
          
          if let Some(tray) = handle.tray_by_id("main") {
            #[cfg(target_os = "macos")]
            let _ = tray.set_title(Some(tray_text.clone()));
            let _ = tray.set_tooltip(Some(tray_text));
          }
        }
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_pomodoro_state,
      toggle_timer,
      reset_timer,
      skip_mode,
      update_settings,
      open_main,
      toggle_floating_window,
      show_notification
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}