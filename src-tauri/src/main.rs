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
  pub current_task: Option<String>,
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
      work_duration: 60, short_break_duration: 10, long_break_duration: 20,
      long_break_interval: 2, auto_start_breaks: true, auto_start_pomodoros: false,
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

fn next_mode_after_skip(mode: &str, sessions_completed: u32, settings: &PomodoroSettings) -> (String, u32) {
  if mode == "work" {
    let is_long = sessions_completed > 0 && (sessions_completed + 1) % settings.long_break_interval == 0;
    let next_mode = if is_long { "longBreak" } else { "shortBreak" }.to_string();
    let next_time_left = if is_long {
      settings.long_break_duration.max(1)
    } else {
      settings.short_break_duration.max(1)
    } * 60;
    (next_mode, next_time_left)
  } else {
    ("work".to_string(), settings.work_duration.max(1) * 60)
  }
}

fn truncate_for_tray(task: &str, max_chars: usize) -> String {
  let truncated = task.chars().take(max_chars).collect::<String>();
  if task.chars().count() > max_chars {
    format!("{}…", truncated)
  } else {
    truncated
  }
}

fn format_tray_text(mode: &str, time_left: u32, current_task: Option<&str>) -> String {
  let mode_str = if mode == "work" { "专注" } else { "休息" };
  let time_str = format!("{:02}:{:02}", time_left / 60, time_left % 60);

  #[cfg(target_os = "macos")]
  {
    if let Some(task) = current_task {
      if !task.is_empty() && mode == "work" {
        return format!("{} {}", truncate_for_tray(task, 10), time_str);
      }
    }
    return format!("{} {}", mode_str, time_str);
  }

  if let Some(task) = current_task {
    if !task.is_empty() && mode == "work" {
      format!("任务: {} | {}: {}", task, mode_str, time_str)
    } else {
      format!("{}: {}", mode_str, time_str)
    }
  } else {
    format!("{}: {}", mode_str, time_str)
  }
}

fn format_tray_tooltip(mode: &str, time_left: u32, current_task: Option<&str>) -> String {
  let mode_str = if mode == "work" { "专注" } else { "休息" };
  let time_str = format!("{:02}:{:02}", time_left / 60, time_left % 60);

  if let Some(task) = current_task {
    if !task.is_empty() && mode == "work" {
      return format!("任务: {} | {}: {}", task, mode_str, time_str);
    }
  }

  format!("{}: {}", mode_str, time_str)
}

fn floating_window_spec(mode: &str) -> (&'static str, f64, f64, bool) {
  if mode == "mini" {
    ("/?view=floating&mode=mini", 232.0, 56.0, true)
  } else {
    ("/?view=floating", 312.0, 208.0, true)
  }
}

fn preferred_floating_size(mode: &str, width: Option<f64>, height: Option<f64>) -> (f64, f64) {
  let (_, default_width, default_height, _) = floating_window_spec(mode);
  let (min_width, min_height, max_width, max_height) = if mode == "mini" {
    (208.0, 56.0, 320.0, 120.0)
  } else {
    (292.0, 188.0, 560.0, 360.0)
  };

  (
    width.unwrap_or(default_width).clamp(min_width, max_width),
    height.unwrap_or(default_height).clamp(min_height, max_height),
  )
}

fn legacy_daily_planner_ai_dir() -> Option<PathBuf> {
  std::env::var_os("APPDATA")
    .map(PathBuf::from)
    .map(|path| path.join("daily-planner-ai").join("Local Storage").join("leveldb"))
}

fn extract_utf16_json_after_key(bytes: &[u8], key: &str) -> Option<String> {
  let key_bytes = key.as_bytes();
  let key_index = bytes.windows(key_bytes.len()).position(|window| window == key_bytes)?;
  let search_from = key_index + key_bytes.len();

  let mut json_start = None;
  let upper_bound = bytes.len().saturating_sub(1);
  for i in search_from..upper_bound {
    if bytes[i] == b'{' && bytes[i + 1] == 0 {
      json_start = Some(i);
      break;
    }
  }

  let mut cursor = json_start?;
  let mut result = String::new();
  let mut depth = 0usize;
  let mut in_string = false;
  let mut escaped = false;

  while cursor + 1 < bytes.len() {
    let code_unit = u16::from_le_bytes([bytes[cursor], bytes[cursor + 1]]);
    cursor += 2;

    let ch = match char::decode_utf16([code_unit]).next() {
      Some(Ok(ch)) => ch,
      _ => return None,
    };

    result.push(ch);

    if escaped {
      escaped = false;
      continue;
    }

    match ch {
      '\\' if in_string => escaped = true,
      '"' => in_string = !in_string,
      '{' if !in_string => depth += 1,
      '}' if !in_string => {
        depth = depth.saturating_sub(1);
        if depth == 0 {
          return Some(result);
        }
      }
      _ => {}
    }
  }

  None
}

fn read_legacy_daily_planner_ai_store_json() -> Option<String> {
  let dir = legacy_daily_planner_ai_dir()?;
  if !dir.exists() {
    return None;
  }

  let mut entries = fs::read_dir(dir)
    .ok()?
    .filter_map(|entry| entry.ok())
    .filter(|entry| {
      entry
        .path()
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| matches!(ext, "log" | "ldb"))
        .unwrap_or(false)
    })
    .collect::<Vec<_>>();

  entries.sort_by_key(|entry| {
    (
      entry
        .path()
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| if ext == "log" { 0 } else { 1 })
        .unwrap_or(2),
      std::cmp::Reverse(
        entry
          .metadata()
          .and_then(|metadata| metadata.modified())
          .ok(),
      ),
    )
  });

  for entry in entries {
    let Ok(bytes) = fs::read(entry.path()) else {
      continue;
    };

    if let Some(json) = extract_utf16_json_after_key(&bytes, "daily-planner-storage-v5") {
      return Some(json);
    }
  }

  None
}

#[tauri::command]
fn open_main(handle: AppHandle) { perform_open_main(&handle); }

#[tauri::command]
fn get_pomodoro_state(state: tauri::State<'_, AppState>) -> PomodoroState {
  state.state.lock().unwrap().clone()
}

#[tauri::command]
fn update_task_name(name: Option<String>, state: tauri::State<'_, AppState>, handle: AppHandle) {
  let mut s = state.state.lock().unwrap();
  s.current_task = name;
  let _ = handle.emit("pomodoro_tick", s.clone());
}

#[tauri::command]
fn toggle_timer(state: tauri::State<'_, AppState>, handle: AppHandle) {
  let mut s = state.state.lock().unwrap();
  let was_active = s.is_active;
  s.is_active = !s.is_active;

  if !was_active && s.is_active && s.mode == "work" {
    show_system_notification(&handle, "开始专注", "开始这一轮专注，保持节奏。");
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
  let (next_mode, next_time_left) = next_mode_after_skip(&s.mode, s.sessions_completed, &s.settings);
  s.mode = next_mode;
  s.time_left = next_time_left;
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
async fn toggle_floating_window(handle: tauri::AppHandle, mode: Option<String>, width: Option<f64>, height: Option<f64>) {
  #[cfg(target_os = "macos")]
  {
    let _ = handle.emit("mac_statusbar_hint", ());
    return;
  }

  #[cfg(not(target_os = "macos"))]
  {
    if let Some(window) = handle.get_webview_window("floating") {
      let _ = window.close();
    } else {
      let safe_mode = mode.unwrap_or_else(|| "standard".to_string());
      let safe_mode = if safe_mode == "mini" { "mini" } else { "standard" };
      let (url, _, _, resizable) = floating_window_spec(safe_mode);
      let (width, height) = preferred_floating_size(safe_mode, width, height);
      let _ = tauri::WebviewWindowBuilder::new(
        &handle,
        "floating",
        tauri::WebviewUrl::App(url.into())
      )
      .title("Floating")
      .inner_size(width, height)
      .resizable(resizable)
      .decorations(false)
      .transparent(false)
      .always_on_top(true)
      .skip_taskbar(true)
      .build();
    }
  }
}

#[tauri::command]
async fn open_floating_mode(handle: tauri::AppHandle, mode: String, width: Option<f64>, height: Option<f64>) {
  #[cfg(target_os = "macos")]
  {
    let _ = handle.emit("mac_statusbar_hint", ());
    return;
  }

  #[cfg(not(target_os = "macos"))]
  {
  let safe_mode = if mode == "mini" { "mini" } else { "standard" };
  let (url, _, _, resizable) = floating_window_spec(safe_mode);
  let (width, height) = preferred_floating_size(safe_mode, width, height);
  if let Some(window) = handle.get_webview_window("floating") {
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }));
    let _ = window.set_resizable(resizable);
    let _ = window.eval(&format!(
      "window.localStorage.setItem('floating-pomodoro-mode', '{}'); window.dispatchEvent(new CustomEvent('floating-mode-changed', {{ detail: '{}' }}));",
      safe_mode, safe_mode
    ));
    let _ = window.show();
    let _ = window.set_focus();
  } else {
    let _ = tauri::WebviewWindowBuilder::new(
      &handle,
      "floating",
      tauri::WebviewUrl::App(url.into())
    )
    .title("Floating")
    .inner_size(width, height)
    .resizable(resizable)
    .decorations(false)
    .transparent(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .build();
  }
  }
}

#[tauri::command]
async fn open_floating_settings(handle: tauri::AppHandle) {
  if let Some(window) = handle.get_webview_window("floating-settings") {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
  } else {
    let _ = tauri::WebviewWindowBuilder::new(
      &handle,
      "floating-settings",
      tauri::WebviewUrl::App("/?view=floating-settings".into())
    )
    .title("Floating Settings")
    .inner_size(440.0, 420.0)
    .resizable(true)
    .decorations(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .build();
  }
}

#[tauri::command]
fn get_runtime_platform() -> String {
  std::env::consts::OS.to_string()
}

#[tauri::command]
fn broadcast_floating_preferences(theme: String, opacity: f64, handle: AppHandle) {
  let _ = handle.emit("floating_preferences_changed", serde_json::json!({
    "theme": theme,
    "opacity": opacity
  }));
}

#[tauri::command]
fn load_legacy_daily_planner_ai_store() -> Option<String> {
  read_legacy_daily_planner_ai_store_json()
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
      
      let icon_work_path = resource_path.join("public/tray-work-mac.png");
      let icon_rest_path = resource_path.join("public/tray-rest-mac.png");


      let icon_work = Image::from_path(icon_work_path).ok();
      let icon_rest = Image::from_path(icon_rest_path).ok();

      let config_path = get_config_path(&handle).join("pomodoro_settings.json");
      let state_path = get_config_path(&handle).join("pomodoro_state.json");
      let settings = load_settings(&config_path);
      let p_state = load_persistent_state(&state_path);
      
      let initial_state = PomodoroState { time_left: settings.work_duration.max(1) * 60, is_active: false, mode: "work".to_string(), sessions_completed: p_state.sessions_completed, last_date: p_state.last_date, settings, current_task: None };
      let state_ptr = Arc::new(Mutex::new(initial_state));
      app.manage(AppState { state: state_ptr.clone(), config_path });

      let show_i = MenuItem::with_id(app, "show", "显示主界面", true, None::<&str>).unwrap();
      let quit_i = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>).unwrap();
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
                
                let is_long = s.sessions_completed % s.settings.long_break_interval == 0;
                s.mode = (if is_long { "longBreak" } else { "shortBreak" }).to_string();
                s.time_left = (if is_long { s.settings.long_break_duration.max(1) } else { s.settings.short_break_duration.max(1) }) * 60;
                
                if s.settings.stop_after_sessions > 0 && s.sessions_completed >= s.settings.stop_after_sessions { 
                  s.is_active = false; 
                  show_system_notification(&handle, "目标达成", "今天的番茄目标已经完成。");
                } else {
                   s.is_active = s.settings.auto_start_breaks;
                   show_system_notification(&handle, "专注结束", "这一轮专注已完成，起来活动一下。");
                }
              } else {
                let was_long = s.mode == "longBreak";
                let _ = handle.emit("break_completed", ());
                if was_long && s.settings.stop_after_long_break {
                  // Bug Fix: Reset to work mode properly
                  s.is_active = false; 
                  s.mode = "work".to_string();
                  s.time_left = s.settings.work_duration.max(1) * 60;
                }
                else {
                   s.mode = "work".to_string();
                   s.time_left = s.settings.work_duration.max(1) * 60;
                   s.is_active = s.settings.auto_start_pomodoros;
                }
                if s.mode == "work" && s.is_active {
                  show_system_notification(&handle, "开始专注", "休息结束，开始下一轮专注。");
                } else {
                  show_system_notification(&handle, "休息结束", "休息完成，可以准备进入下一轮专注。");
                }
              }
            }
            let _ = handle.emit("pomodoro_tick", s.clone());
          }

          if let Some(tray) = handle.tray_by_id("main") {
            let tray_tooltip = format_tray_tooltip(&s.mode, s.time_left, s.current_task.as_deref());
            
            #[cfg(target_os = "macos")]
            {
              let tray_text = format_tray_text(&s.mode, s.time_left, s.current_task.as_deref());
              let _ = tray.set_title(Some(tray_text));
            }
            let _ = tray.set_tooltip(Some(tray_tooltip));

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
    .invoke_handler(tauri::generate_handler![get_pomodoro_state, toggle_timer, reset_timer, skip_mode, update_settings, open_main, show_notification, toggle_floating_window, open_floating_mode, open_floating_settings, get_runtime_platform, broadcast_floating_preferences, update_task_name, load_legacy_daily_planner_ai_store])
    .build(tauri::generate_context!())
    .expect("error");

  app.run(|_app_handle, _event| {
    #[cfg(target_os = "macos")]
    if let tauri::RunEvent::Reopen { .. } = _event {
      perform_open_main(_app_handle);
    }
  });
}

#[cfg(test)]
mod tests {
  use super::{extract_utf16_json_after_key, format_tray_text, format_tray_tooltip, next_mode_after_skip, truncate_for_tray, PomodoroSettings};

  #[test]
  fn skip_mode_moves_work_session_into_short_break_by_default() {
    let settings = PomodoroSettings::default();
    let (mode, time_left) = next_mode_after_skip("work", 1, &settings);
    assert_eq!(mode, "shortBreak");
    assert_eq!(time_left, settings.short_break_duration * 60);
  }

  #[test]
  fn skip_mode_moves_into_long_break_on_interval() {
    let settings = PomodoroSettings::default();
    let (mode, time_left) = next_mode_after_skip("work", settings.long_break_interval - 1, &settings);
    assert_eq!(mode, "longBreak");
    assert_eq!(time_left, settings.long_break_duration * 60);
  }

  #[test]
  fn tray_text_prefers_task_when_available() {
    let work_text = format_tray_text("work", 25 * 60, Some("深度工作"));
    let break_text = format_tray_text("shortBreak", 5 * 60, Some("深度工作"));

    assert_eq!(work_text, "任务: 深度工作 | 专注: 25:00");
    assert_eq!(break_text, "休息: 05:00");
  }

  #[test]
  fn tray_tooltip_keeps_full_task_and_timer() {
    let tooltip = format_tray_tooltip("work", 25 * 60, Some("完成季度复盘初稿"));
    let break_tooltip = format_tray_tooltip("shortBreak", 5 * 60, Some("完成季度复盘初稿"));

    assert_eq!(tooltip, "任务: 完成季度复盘初稿 | 专注: 25:00");
    assert_eq!(break_tooltip, "休息: 05:00");
  }

  #[test]
  fn tray_truncation_adds_ellipsis_for_long_titles() {
    assert_eq!(truncate_for_tray("完成季度复盘初稿并整理发布说明", 10), "完成季度复盘初稿并整…");
    assert_eq!(truncate_for_tray("短任务", 10), "短任务");
  }

  #[test]
  fn extracts_legacy_store_json_from_utf16_bytes() {
    let json = concat!(
      "{",
      "\"state\":{",
      "\"tasks\":[{\"id\":\"1\",\"title\":\"旧任务\"}]",
      "},",
      "\"version\":5",
      "}"
    );
    let mut bytes = b"headerdaily-planner-storage-v5".to_vec();
    bytes.extend_from_slice(
      &json
        .encode_utf16()
        .flat_map(|unit| unit.to_le_bytes())
        .collect::<Vec<_>>(),
    );

    let extracted = extract_utf16_json_after_key(&bytes, "daily-planner-storage-v5").expect("should extract json");
    assert!(extracted.contains("\"tasks\""));
    assert!(extracted.contains("旧任务"));
  }
}
