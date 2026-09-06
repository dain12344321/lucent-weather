using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
// Read-only taskbar geometry helper, built as a Windows GUI executable.
class Geometry {
 [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left,Top,Right,Bottom; }
 [StructLayout(LayoutKind.Sequential)] struct Point { public int X,Y; }
 [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point p);
 [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h,uint flags);
 [DllImport("user32.dll")] static extern IntPtr FindWindow(string c,string t);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h,uint command);
 [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 static string Json(Rect r){return "{\"x\":"+r.Left+",\"y\":"+r.Top+",\"width\":"+(r.Right-r.Left)+",\"height\":"+(r.Bottom-r.Top)+"}";}
 static void Main(string[] args){
  try{
   int pid;long widgetId;if(args.Length!=2||!int.TryParse(args[0],out pid)||!long.TryParse(args[1],out widgetId))return;
   IntPtr widget=new IntPtr(widgetId);
   var parent=Process.GetProcessById(pid);SetProcessDPIAware();
   using(var output=new System.IO.StreamWriter(Console.OpenStandardOutput(),new UTF8Encoding(false))){
    output.AutoFlush=true;
    while(!parent.HasExited){
     IntPtr h=FindWindow("Shell_TrayWnd",null),fg=GetForegroundWindow();Rect bar,front;
     bool ok=GetWindowRect(h,out bar);GetWindowRect(fg,out front);
     bool taskbarAbove=false;IntPtr above=GetWindow(widget,3);for(int i=0;i<128&&above!=IntPtr.Zero;i++){if(above==h){taskbarAbove=true;break;}above=GetWindow(above,3);}
     bool taskbarExposed=ok && GetAncestor(WindowFromPoint(new Point{X=bar.Left+2,Y=bar.Top+(bar.Bottom-bar.Top)/2}),2)==h;
     var cls=new StringBuilder(256);GetClassName(fg,cls,256);
     output.WriteLine("{\"taskbarExposed\":"+(taskbarExposed?"true":"false")+",\"taskbarAbove\":"+(taskbarAbove?"true":"false")+",\"visible\":"+((ok&&IsWindowVisible(h))?"true":"false")+",\"frontClass\":\""+cls.ToString().Replace("\\","\\\\").Replace("\"","\\\"")+"\",\"bar\":"+Json(bar)+",\"front\":"+Json(front)+"}");
     Thread.Sleep(700);
    }
   }
  }catch{}
 }
}
