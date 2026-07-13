use std::time::Duration;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as AutostartExt};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

const PRODUCTION_URL: &str = "https://macroverse.vercel.app";

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn toggle_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            show_main(app);
        }
    }
}

fn check_for_updates(app: tauri::AppHandle, interactive: bool) {
    tauri::async_runtime::spawn(async move {
        match app.updater() {
            Ok(updater) => match updater.check().await {
                Ok(Some(update)) => {
                    let version = update.version.clone();
                    let app_for_install = app.clone();
                    app.dialog()
                        .message(format!("MacroTray {version} is ready. Install it now? The widget will close during the Windows update."))
                        .title("MacroTray update")
                        .ok_button_label("Install")
                        .cancel_button_label("Later")
                        .show(move |install| {
                            if install {
                                tauri::async_runtime::spawn(async move {
                                    if update.download_and_install(|_, _| {}, || {}).await.is_ok() {
                                        app_for_install.restart();
                                    }
                                });
                            }
                        });
                }
                Ok(None) if interactive => {
                    app.dialog().message("MacroTray is up to date.").title("Check for updates").show(|_| {});
                }
                Err(error) if interactive => {
                    app.dialog().message(format!("Could not check for updates: {error}")).title("Check for updates").show(|_| {});
                }
                _ => {}
            },
            Err(error) if interactive => {
                app.dialog().message(format!("Updater is not configured: {error}")).title("Check for updates").show(|_| {});
            }
            _ => {}
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _, _| show_main(app)));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            app.handle().plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))?;

            let origin = option_env!("MACROTRAY_APP_URL").unwrap_or(PRODUCTION_URL).trim_end_matches('/').to_string();
            let widget_url = format!("{origin}/macrotray");
            let navigation_origin = origin.clone();
            let opener = app.handle().clone();
            let navigation_app = app.handle().clone();
            let user_agent = format!("MacroTray/{}", env!("CARGO_PKG_VERSION"));
            let startup_script = format!("window.__MACROTRAY_URL__ = {:?};", widget_url);
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("MacroTray")
                .user_agent(&user_agent)
                .initialization_script(startup_script)
                .inner_size(420.0, 700.0)
                .min_inner_size(360.0, 520.0)
                .resizable(true)
                .on_navigation(move |url| {
                    if url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost") {
                        return true;
                    }
                    if url.as_str() == "https://macrotray.invalid/hide" {
                        if let Some(window) = navigation_app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                        return false;
                    }
                    let trusted = url.as_str() == navigation_origin
                        || url.as_str().starts_with(&format!("{navigation_origin}/"));
                    let pairing = url.path().starts_with("/macrotray-connect");
                    if trusted && !pairing { return true; }
                    let _ = opener.opener().open_url(url.as_str(), None::<&str>);
                    false
                })
                .build()?;
            let window_for_events = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_for_events.hide();
                }
            });

            let open = MenuItem::with_id(app, "open", "Open MacroTray", true, None::<&str>)?;
            let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);
            let autostart = CheckMenuItem::with_id(app, "autostart", "Start with Windows", true, autostart_enabled, None::<&str>)?;
            let updates = MenuItem::with_id(app, "updates", "Check for updates", true, None::<&str>)?;
            let website = MenuItem::with_id(app, "website", "Open MacroVerse", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &autostart, &updates, &website, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("MacroTray icon").clone())
                .tooltip("MacroTray quick logger")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if matches!(event, TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. }) {
                        toggle_main(tray.app_handle());
                    }
                })
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "autostart" => {
                        let manager = app.autolaunch();
                        let enabled = manager.is_enabled().unwrap_or(false);
                        let _ = if enabled { manager.disable() } else { manager.enable() };
                        let _ = autostart.set_checked(!enabled);
                    }
                    "updates" => check_for_updates(app.clone(), true),
                    "website" => { let _ = app.opener().open_url(PRODUCTION_URL, None::<&str>); }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            let update_handle = app.handle().clone();
            check_for_updates(update_handle.clone(), false);
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(Duration::from_secs(24 * 60 * 60)).await;
                    check_for_updates(update_handle.clone(), false);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running MacroTray");
}
