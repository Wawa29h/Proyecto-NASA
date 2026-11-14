"""Ventana para guardar tu login de NASA Earthdata en ~/.netrc y probarlo.
La contrasena va directo al archivo; el script nunca la imprime.
Uso: python scripts/login_earthdata.py
"""
import os
import tkinter as tk
from tkinter import messagebox

NETRC = os.path.join(os.path.expanduser("~"), ".netrc")


def guardar():
    user = e_user.get().strip()
    pwd = e_pwd.get()
    if not user or not pwd:
        messagebox.showwarning("Falta algo", "Escribe usuario y contrasena.")
        return
    if any(c.isspace() for c in user + pwd):
        messagebox.showwarning("Ojo", "El usuario o la contrasena tienen espacios; .netrc no los acepta.")
        return
    with open(NETRC, "w", encoding="ascii", errors="strict", newline="\n") as fh:
        fh.write(f"machine urs.earthdata.nasa.gov login {user} password {pwd}\n")
    btn.config(text="Probando...", state="disabled")
    root.update()
    try:
        import earthaccess
        auth = earthaccess.login(strategy="netrc")
        ok = bool(getattr(auth, "authenticated", False))
    except Exception as ex:  # noqa: BLE001
        ok = False
        print("Error al probar login:", type(ex).__name__)
    if ok:
        print("LOGIN_OK")
        messagebox.showinfo("Listo", "Login de Earthdata correcto. Ya puedes cerrar esta ventana.")
        root.destroy()
    else:
        print("LOGIN_FALLO")
        messagebox.showerror("No entro", "Earthdata rechazo el usuario o la contrasena. Revisa y vuelve a intentar.")
        btn.config(text="Guardar y probar", state="normal")


root = tk.Tk()
root.title("Login NASA Earthdata")
root.geometry("360x190")
root.attributes("-topmost", True)
tk.Label(root, text="Usuario de Earthdata").pack(pady=(14, 2))
e_user = tk.Entry(root, width=32)
e_user.pack()
tk.Label(root, text="Contraseña").pack(pady=(8, 2))
e_pwd = tk.Entry(root, width=32, show="*")
e_pwd.pack()
btn = tk.Button(root, text="Guardar y probar", command=guardar)
btn.pack(pady=12)
e_user.focus_set()
root.bind("<Return>", lambda _e: guardar())
root.mainloop()
