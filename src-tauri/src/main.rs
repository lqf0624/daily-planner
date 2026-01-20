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
  menu::{Menu, MenuItem},
  tray::{TrayIconBuilder, TrayIconEvent, MouseButton},
  image::Image
};
#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
use tauri_plugin_notification::NotificationExt;
#[cfg(any(target_os = "macos", target_os = "windows"))]
use notify_rust::Notification as NotifyRustNotification;
use tokio::time::{interval, Duration};
use chrono::Local;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct PomodoroSettings {
  pub work_duration: u32,
  pub short_break_duration: u32,
  pub long_break_duration: u32,
  pub long_break_interval: u32,
  pub auto_start_breaks: bool,
  pub auto_start_pomodoros: bool,
  pub max_sessions: u32,
  pub stop_after_sessions: u32,
  pub stop_after_long_break: bool,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct PomodoroState {
  pub time_left: u32,
  pub is_active: bool,
  pub mode: String,
  pub sessions_completed: u32,
  pub last_date: String,
  pub settings: PomodoroSettings,
}

#[derive(Clone, Serialize, Deserialize, Debug, Default)]
pub struct PomodoroPersistentState {
  pub sessions_completed: u32,
  pub last_date: String,
}

struct AppState {
  state: Arc<Mutex<PomodoroState>>,
  config_path: PathBuf,
}

impl Default for PomodoroSettings {
  fn default() -> Self {
    Self {
      work_duration: 25, short_break_duration: 5, long_break_duration: 15,
      long_break_interval: 4, auto_start_breaks: true, auto_start_pomodoros: false, 
      max_sessions: 8, stop_after_sessions: 0, stop_after_long_break: false,
    }
  }
}

fn get_config_path(app_handle: &AppHandle) -> PathBuf {
  let path = app_handle.path().app_config_dir().expect("dir err");
  if !path.exists() { let _ = fs::create_dir_all(&path); }
  path
}

fn load_settings(path: &PathBuf) -> PomodoroSettings {
  if let Ok(content) = fs::read_to_string(path) {
    if let Ok(settings) = serde_json::from_str::<PomodoroSettings>(&content) { return settings; }
  }
  PomodoroSettings::default()
}

fn save_settings(path: &PathBuf, settings: &PomodoroSettings) {
  if let Ok(content) = serde_json::to_string_pretty(settings) { let _ = fs::write(path, content); }
}

fn load_persistent_state(path: &PathBuf) -> PomodoroPersistentState {
  let today = Local::now().format("%Y-%m-%d").to_string();
  if let Ok(content) = fs::read_to_string(path) {
    if let Ok(p_state) = serde_json::from_str::<PomodoroPersistentState>(&content) {
      if p_state.last_date == today { return p_state; }
    }
  }
  PomodoroPersistentState { sessions_completed: 0, last_date: today }
}

fn save_persistent_state(path: &PathBuf, sessions: u32) {
  let p_state = PomodoroPersistentState { sessions_completed: sessions, last_date: Local::now().format("%Y-%m-%d").to_string() };
  if let Ok(content) = serde_json::to_string_pretty(&p_state) { let _ = fs::write(path, content); }
}

fn perform_open_main(handle: &AppHandle) {
  if let Some(window) = handle.get_webview_window("main") {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
  } else if let Some(config) = handle.config().app.windows.iter().find(|w| w.label == "main") {
    if let Ok(window) = tauri::WebviewWindowBuilder::from_config(handle, config).and_then(|builder| builder.build()) {
      let _ = window.show();
      let _ = window.set_focus();
    }
  }
}

fn show_system_notification(handle: &AppHandle, title: &str, body: &str) {
  #[cfg(target_os = "windows")]
  {
    let identifier = handle.config().identifier.clone();
    let title = title.to_string();
    let body = body.to_string();
    let handle = handle.clone();

    let _ = handle.run_on_main_thread(move || {
      let mut notification = NotifyRustNotification::new();
      notification.summary(&title);
      notification.body(&body);
      notification.auto_icon();
      notification.app_id(&identifier);

      if notification.show().is_ok() {
        return;
      }

      let mut fallback = NotifyRustNotification::new();
      fallback.summary(&title);
      fallback.body(&body);
      fallback.auto_icon();
      let _ = fallback.show();
    });

    return;
  }

  #[cfg(target_os = "macos")]
  {
    let identifier = handle.config().identifier.clone();
    let title = title.to_string();
    let body = body.to_string();

    tauri::async_runtime::spawn(async move {
      let mut notification = NotifyRustNotification::new();
      notification.summary(&title);
      notification.body(&body);
      notification.auto_icon();

      let preferred_app_id = identifier;

      let mut application = preferred_app_id.clone();
      if notify_rust::set_application(&application).is_err() && application != "com.apple.Terminal" {
        application = "com.apple.Terminal".to_string();
        let _ = notify_rust::set_application(&application);
      }

      let result = notification.show();
      if result.is_err() && application != "com.apple.Terminal" {
        if notify_rust::set_application("com.apple.Terminal").is_ok() {
          let mut fallback = NotifyRustNotification::new();
          fallback.summary(&title);
          fallback.body(&body);
          fallback.auto_icon();
          let _ = fallback.show();
        }
      }
    });
  }

  #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
  {
    let _ = handle
      .notification()
      .builder()
      .title(title)
      .body(body)
      .show();
  }
}

#[tauri::command]
fn open_main(handle: AppHandle) { perform_open_main(&handle); }

#[tauri::command]
fn get_pomodoro_state(state: tauri::State<'_, AppState>) -> PomodoroState {
  state.state.lock().unwrap().clone()
}

#[tauri::command]
fn toggle_timer(state: tauri::State<'_, AppState>, handle: AppHandle) {
  let mut s = state.state.lock().unwrap();
  let was_active = s.is_active;
  s.is_active = !s.is_active;

  // 专注开始提醒：手动启动 / 继续专注时触发
  if !was_active && s.is_active && s.mode == "work" {
    show_system_notification(&handle, "专注开始", "开始专注，保持节奏！");
  }

  let _ = handle.emit("pomodoro_tick", s.clone());
}

#[tauri::command]
fn reset_timer(state: tauri::State<'_, AppState>, handle: AppHandle) {
  let mut s = state.state.lock().unwrap();
  s.is_active = false;
  s.time_left = match s.mode.as_str() {
    "shortBreak" => s.settings.short_break_duration.max(1) * 60,
    "longBreak" => s.settings.long_break_duration.max(1) * 60,
    _ => s.settings.work_duration.max(1) * 60,
  };
  let _ = handle.emit("pomodoro_tick", s.clone());
}

#[tauri::command]
fn skip_mode(state: tauri::State<'_, AppState>, handle: AppHandle) {
  let mut s = state.state.lock().unwrap();
  if s.mode == "work" {
    let is_long = s.sessions_completed > 0 && (s.sessions_completed + 1) % s.settings.long_break_interval == 0;
    s.mode = (if is_long { "longBreak" } else { "shortBreak" }).to_string();
    s.time_left = (if is_long { s.settings.long_break_duration.max(1) } else { s.settings.short_break_duration.max(1) }) * 60;
  } else {
    s.mode = "work".to_string();
    s.time_left = s.settings.work_duration.max(1) * 60;
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
      "shortBreak" => s.settings.short_break_duration.max(1) * 60,
      "longBreak" => s.settings.long_break_duration.max(1) * 60,
      _ => s.settings.work_duration.max(1) * 60,
    };
  }
  let _ = handle.emit("pomodoro_tick", s.clone());
}

#[tauri::command]
fn show_notification(title: String, body: String, handle: AppHandle) {
  show_system_notification(&handle, &title, &body);
}

#[tauri::command]
async fn toggle_floating_window(handle: tauri::AppHandle) {
  if let Some(window) = handle.get_webview_window("floating") {
    let _ = window.close();
  } else {
    let _ = tauri::WebviewWindowBuilder::new(
      &handle,
      "floating",
      tauri::WebviewUrl::App("/?view=floating".into())
    )
    .title("Floating")
    .inner_size(220.0, 220.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .build();
  }
}

fn main() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      perform_open_main(app);
    }))
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      let handle = app.handle().clone();
      let resource_path = handle.path().resource_dir().expect("Failed res dir");
      
      // 动态解析图标路径
      let icon_work_path = resource_path.join("public/tray-work-mac.png");
      let icon_rest_path = resource_path.join("public/tray-rest-mac.png");

      // 仅加载，若失败则为 None，不引用带有生命周期的 app 对象
      let icon_work = Image::from_path(icon_work_path).ok();
      let icon_rest = Image::from_path(icon_rest_path).ok();

      let config_path = get_config_path(&handle).join("pomodoro_settings.json");
      let state_path = get_config_path(&handle).join("pomodoro_state.json");
      let settings = load_settings(&config_path);
      let p_state = load_persistent_state(&state_path);
      
      let initial_state = PomodoroState { time_left: settings.work_duration.max(1) * 60, is_active: false, mode: "work".to_string(), sessions_completed: p_state.sessions_completed, last_date: p_state.last_date, settings };
      let state_ptr = Arc::new(Mutex::new(initial_state));
      app.manage(AppState { state: state_ptr.clone(), config_path });

      let show_i = MenuItem::with_id(app, "show", "显示主界面", true, None::<&str>).unwrap();
      let quit_i = MenuItem::with_id(app, "quit", "彻底退出应用", true, None::<&str>).unwrap();
      let menu = Menu::with_items(app, &[&show_i, &quit_i]).unwrap();

      let _tray = TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app_handle, event| {
          if event.id.as_ref() == "show" { perform_open_main(app_handle); }
          else if event.id.as_ref() == "quit" { app_handle.exit(0); }
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } = event {
            perform_open_main(tray.app_handle());
          }
        })
        .build(app).expect("Failed to build tray");

      let state_ptr_timer = state_ptr.clone();
      tauri::async_runtime::spawn(async move {
        let mut interval = interval(Duration::from_secs(1));
        let mut last_mode = String::new();

        loop {
          interval.tick().await;
          let mut s = state_ptr_timer.lock().unwrap();
          let today = Local::now().format("%Y-%m-%d").to_string();
          if s.last_date != today {
            s.last_date = today;
            s.sessions_completed = 0;
            save_persistent_state(&state_path, s.sessions_completed);
          }
          if s.is_active {
            if s.time_left > 0 { s.time_left -= 1; }
            else {
              s.is_active = false;
              if s.mode == "work" {
                let _ = handle.emit("pomodoro_completed", s.settings.work_duration);
                s.sessions_completed += 1;
                save_persistent_state(&state_path, s.sessions_completed);
                if s.settings.stop_after_sessions > 0 && s.sessions_completed >= s.settings.stop_after_sessions { s.is_active = false; }
                else {
                   let is_long = s.sessions_completed % s.settings.long_break_interval == 0;
                   s.mode = (if is_long { "longBreak" } else { "shortBreak" }).to_string();
                   s.time_left = (if is_long { s.settings.long_break_duration.max(1) } else { s.settings.short_break_duration.max(1) }) * 60;
                   s.is_active = s.settings.auto_start_breaks;
                }
                show_system_notification(&handle, "专注结束", "一轮专注完成，起身放松一下吧。");
              } else {
                let was_long = s.mode == "longBreak";
                let _ = handle.emit("break_completed", ());
                if was_long && s.settings.stop_after_long_break { s.is_active = false; }
                else {
                   s.mode = "work".to_string();
                   s.time_left = s.settings.work_duration.max(1) * 60;
                   s.is_active = s.settings.auto_start_pomodoros;
                }
                if s.mode == "work" && s.is_active {
                  show_system_notification(&handle, "专注开始", "休息完成，开始下一轮专注吧！");
                } else {
                  show_system_notification(&handle, "休息结束", "休息完成，可以开始下一轮专注了。");
                }
              }
            }
            let _ = handle.emit("pomodoro_tick", s.clone());
          }

          if let Some(tray) = handle.tray_by_id("main") {
            let tray_text = format!("{}: {:02}:{:02}", if s.mode == "work" { "专注" } else { "休息" }, s.time_left / 60, s.time_left % 60);
            #[cfg(target_os = "macos")] let _ = tray.set_title(Some(tray_text.clone()));
            let _ = tray.set_tooltip(Some(tray_text));

            if s.mode != last_mode {
              if let Some(icon) = if s.mode == "work" { icon_work.clone() } else { icon_rest.clone() } {
                let _ = tray.set_icon(Some(icon));
              }
              last_mode = s.mode.clone();
            }
          }
        }
      });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![get_pomodoro_state, toggle_timer, reset_timer, skip_mode, update_settings, open_main, show_notification, toggle_floating_window])
    .build(tauri::generate_context!())
    .expect("error");

  app.run(|_app_handle, _event| {
    #[cfg(target_os = "macos")]
    if let tauri::RunEvent::Reopen { .. } = _event {
      perform_open_main(_app_handle);
    }
  });
}
